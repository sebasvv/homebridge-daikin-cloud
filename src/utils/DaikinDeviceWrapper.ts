import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';
import { DaikinCloudRepo } from '../repositories/daikinCloudRepo';
import {
    DaikinOperationModes,
    DaikinControlModes,
    DaikinTemperatureControlSetpoints,
    DaikinSetpointModes,
} from '../services/baseService';

export class DaikinDeviceWrapper {
    constructor(
        public readonly device: DaikinCloudDevice,
        private readonly managementPointId: string,
    ) {}

    // Generic Data Access
    public getData(key: string, path?: string) {
        return DaikinCloudRepo.getData(this.device, this.managementPointId, key, path);
    }

    public safeGetValue<T = unknown>(key: string, path: string | undefined, defaultValue: T): T {
        return DaikinCloudRepo.safeGetValue<T>(this.device, this.managementPointId, key, path, defaultValue);
    }

    // specific Capabilities
    public getRoomHumidity(): number | null {
        const humidityData = this.getData('sensoryData', '/roomHumidity');
        if (!humidityData || typeof humidityData.value !== 'number') {
            return null;
        }
        return humidityData.value;
    }

    public getFilterData(): { cleaningInterval: boolean; sign: boolean } {
        const interval = this.getData('filterCleaningInterval', undefined);
        const sign = this.getData('filterSign', undefined);
        return {
            cleaningInterval: !!interval,
            sign: !!sign,
        };
    }

    public hasFilterData(): boolean {
        const { cleaningInterval, sign } = this.getFilterData();
        return cleaningInterval || sign;
    }

    public getCurrentOperationMode(): DaikinOperationModes {
        return this.safeGetValue<DaikinOperationModes>('operationMode', undefined, DaikinOperationModes.AUTO);
    }

    public getCurrentControlMode(): DaikinControlModes {
        const controlMode = this.getData('controlMode', undefined);
        if (!controlMode) {
            return DaikinControlModes.ROOM_TEMPERATURE;
        }
        return controlMode.value as DaikinControlModes;
    }

    public getSetpointMode(): DaikinSetpointModes | null {
        const setpointMode = this.getData('setpointMode', undefined);
        if (!setpointMode) {
            return null;
        }
        return setpointMode.value as DaikinSetpointModes;
    }

    public getSetpointPath(operationMode: DaikinOperationModes): string {
        const setpointType = this.getSetpointType(operationMode);
        return `/operationModes/${operationMode}/setpoints/${setpointType}`;
    }

    // Derived from ClimateControlHelper.getSetpoint
    public getSetpointType(operationMode: DaikinOperationModes): DaikinTemperatureControlSetpoints {
        const setpointMode = this.getSetpointMode();
        const controlMode = this.getCurrentControlMode();

        if (setpointMode) {
            switch (setpointMode) {
                case DaikinSetpointModes.FIXED:
                    switch (controlMode) {
                        case DaikinControlModes.LEAVING_WATER_TEMPERATURE:
                            return DaikinTemperatureControlSetpoints.LEAVING_WATER_TEMPERATURE;
                        default:
                            return DaikinTemperatureControlSetpoints.ROOM_TEMPERATURE;
                    }
                case DaikinSetpointModes.WEATHER_DEPENDENT:
                    switch (controlMode) {
                        case DaikinControlModes.LEAVING_WATER_TEMPERATURE:
                            return DaikinTemperatureControlSetpoints.LEAVING_WATER_OFFSET;
                        default:
                            return DaikinTemperatureControlSetpoints.ROOM_TEMPERATURE;
                    }
                case DaikinSetpointModes.WEATHER_DEPENDENT_HEATING_FIXED_COOLING:
                    switch (controlMode) {
                        case DaikinControlModes.ROOM_TEMPERATURE:
                            return DaikinTemperatureControlSetpoints.ROOM_TEMPERATURE;
                        case DaikinControlModes.LEAVING_WATER_TEMPERATURE:
                            switch (operationMode) {
                                case DaikinOperationModes.HEATING:
                                    return DaikinTemperatureControlSetpoints.LEAVING_WATER_OFFSET;
                                case DaikinOperationModes.COOLING:
                                    return DaikinTemperatureControlSetpoints.LEAVING_WATER_TEMPERATURE;
                            }
                    }
            }
            // Fallback or Error?
            // For wrapper, maybe fallback to ROOM_TEMPERATURE if unsure, or throw to be safe logic-wise.
            // Copied from Helper: throws error.
            throw new Error(
                `Could not determine the TemperatureControlSetpoint for operationMode: ${operationMode}, setpointMode: ${setpointMode}, controlMode: ${controlMode}`,
            );
        }

        // Default if no setpointMode (Standard Split units)
        return DaikinTemperatureControlSetpoints.ROOM_TEMPERATURE;
    }

    public hasPowerfulModeFeature(): boolean {
        return this.getData('powerfulMode', undefined) !== undefined;
    }

    public hasEconoModeFeature(): boolean {
        return this.getData('econoMode', undefined) !== undefined;
    }

    public hasStreamerModeFeature(): boolean {
        return this.getData('streamerMode', undefined) !== undefined;
    }

    public hasOutdoorSilentModeFeature(): boolean {
        return this.getData('outdoorSilentMode', undefined) !== undefined;
    }

    public hasIndoorSilentModeFeature(): boolean {
        // Check if fanSpeed supports 'quiet'.
        // This is an approximation. If fanControl exists, we assume support or we need to dive deeper.
        return this.getData('fanControl', undefined) !== undefined;
    }

    public hasDryOperationModeFeature(): boolean {
        // Check if DRY is a valid operation mode
        // Usually if it's an AC, it supports dry.
        return true;
    }

    public hasFanOnlyOperationModeFeature(): boolean {
        return true;
    }

    public hasSwingModeVerticalFeature(): boolean {
        // Check vertical swing presence under fanControl for current mode (or Auto)
        const opMode = this.getCurrentOperationMode();
        return (
            this.getData('fanControl', `/operationModes/${opMode}/fanDirection/vertical`) !== undefined ||
            this.getData('fanControl', `/operationModes/${DaikinOperationModes.AUTO}/fanDirection/vertical`) !==
                undefined
        );
    }

    public hasSwingModeHorizontalFeature(): boolean {
        const opMode = this.getCurrentOperationMode();
        return (
            this.getData('fanControl', `/operationModes/${opMode}/fanDirection/horizontal`) !== undefined ||
            this.getData('fanControl', `/operationModes/${DaikinOperationModes.AUTO}/fanDirection/horizontal`) !==
                undefined
        );
    }

    public isCoolingSupported(): boolean {
        return true; // Simplified
    }
}
