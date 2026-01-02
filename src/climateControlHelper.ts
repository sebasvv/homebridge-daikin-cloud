import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';
import { DaikinCloudPlatform } from './platform';
import { DaikinCloudRepo } from './repository/daikinCloudRepo';
import {
    DaikinControlModes,
    DaikinFanSpeedModes,
    DaikinOperationModes,
    DaikinTemperatureControlSetpoints,
} from './baseService';

export enum DaikinSetpointModes {
    FIXED = 'fixed',
    WEATHER_DEPENDENT_HEATING_FIXED_COOLING = 'weatherDependentHeatingFixedCooling',
    WEATHER_DEPENDENT = 'weatherDependent'
}

export class ClimateControlHelper {
    constructor(
        private readonly platform: DaikinCloudPlatform,
        private readonly device: DaikinCloudDevice,
        private readonly managementPointId: string,
        private readonly name: string,
    ) { }

    getData(key: string, path?: string) {
        return DaikinCloudRepo.getData(this.device, this.managementPointId, key, path);
    }

    safeGetValue<T = unknown>(key: string, path: string | undefined, defaultValue: T = 0 as unknown as T): T {
        return DaikinCloudRepo.safeGetValue<T>(this.device, this.managementPointId, key, path, defaultValue);
    }

    getCurrentOperationMode(): DaikinOperationModes {
        return this.safeGetValue<DaikinOperationModes>('operationMode', undefined, DaikinOperationModes.AUTO);
    }

    getCurrentControlMode(): DaikinControlModes {
        const controlMode = this.getData('controlMode', undefined);

        // Only Altherma devices have a controlMode, others have a fixed controlMode of ROOM_TEMPERATURE AFAIK
        if (!controlMode) {
            return DaikinControlModes.ROOM_TEMPERATURE;
        }

        return controlMode.value as DaikinControlModes;
    }

    getSetpointMode(): DaikinSetpointModes | null {
        const setpointMode = this.getData('setpointMode', undefined);
        if (!setpointMode) {
            return null;
        }
        return setpointMode.value as DaikinSetpointModes;
    }

    getSetpoint(operationMode: DaikinOperationModes): DaikinTemperatureControlSetpoints {
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


            throw new Error(`Could not determine the TemperatureControlSetpoint for operationMode: ${operationMode}, setpointMode: ${setpointMode}, controlMode: ${controlMode}, for device: ${JSON.stringify(DaikinCloudRepo.maskSensitiveCloudDeviceData(this.device.desc), null, 4)}`);
        }

        switch (controlMode) {
            case DaikinControlModes.LEAVING_WATER_TEMPERATURE:
                return DaikinTemperatureControlSetpoints.LEAVING_WATER_OFFSET;
            default:
                return DaikinTemperatureControlSetpoints.ROOM_TEMPERATURE;
        }
    }

    hasSwingModeVerticalFeature() {
        const verticalSwing = this.getData('fanControl', `/operationModes/${this.getCurrentOperationMode()}/fanDirection/vertical/currentMode`);
        this.platform.log.debug(`[${this.name}] hasSwingModeFeature, verticalSwing: ${Boolean(verticalSwing)}`);
        return Boolean(verticalSwing);
    }

    hasSwingModeHorizontalFeature() {
        const horizontalSwing = this.getData('fanControl', `/operationModes/${this.getCurrentOperationMode()}/fanDirection/horizontal/currentMode`);
        this.platform.log.debug(`[${this.name}] hasSwingModeFeature, horizontalSwing: ${Boolean(horizontalSwing)}`);
        return Boolean(horizontalSwing);
    }

    hasSwingModeFeature() {
        return Boolean(this.hasSwingModeVerticalFeature() || this.hasSwingModeHorizontalFeature());
    }

    hasPowerfulModeFeature() {
        const powerfulMode = this.getData('powerfulMode', undefined);
        this.platform.log.debug(`[${this.name}] hasPowerfulModeFeature, powerfulMode: ${Boolean(powerfulMode)}`);
        return Boolean(powerfulMode);
    }

    hasEconoModeFeature() {
        const econoMode = this.getData('econoMode', undefined);
        this.platform.log.debug(`[${this.name}] hasEconoModeFeature, econoMode: ${Boolean(econoMode)}`);
        return Boolean(econoMode);
    }

    hasStreamerModeFeature() {
        const streamerMode = this.getData('streamerMode', undefined);
        this.platform.log.debug(`[${this.name}] hasStreamerModeFeature, streamerMode: ${Boolean(streamerMode)}`);
        return Boolean(streamerMode);
    }

    hasOutdoorSilentModeFeature() {
        const OutdoorSilentMode = this.getData('outdoorSilentMode', undefined);
        this.platform.log.debug(`[${this.name}] hasOutdoorSilentModeFeature, outdoorSilentMode: ${Boolean(OutdoorSilentMode)}`);
        return Boolean(OutdoorSilentMode);
    }

    hasIndoorSilentModeFeature() {
        const currentModeFanControl = this.getData('fanControl', `/operationModes/${this.getCurrentOperationMode()}/fanSpeed/currentMode`);
        if (!currentModeFanControl) {
            return false;
        }
        const fanSpeedValues: Array<string> = currentModeFanControl.values ?? [];
        this.platform.log.debug(`[${this.name}] hasIndoorSilentModeFeature, indoorSilentMode: ${fanSpeedValues.includes(DaikinFanSpeedModes.QUIET)}`);
        return fanSpeedValues.includes(DaikinFanSpeedModes.QUIET);
    }

    hasOperationMode(operationMode: DaikinOperationModes) {
        const operationModeData = this.getData('operationMode', undefined);
        const operationModeValues: Array<string> = (operationModeData && operationModeData.values) ? operationModeData.values : [];
        this.platform.log.debug(`[${this.name}] has ${operationMode}: ${operationModeValues.includes(operationMode)}`);
        return operationModeValues.includes(operationMode);
    }

    hasDryOperationModeFeature() {
        return this.hasOperationMode(DaikinOperationModes.DRY);
    }

    hasFanOnlyOperationModeFeature() {
        return this.hasOperationMode(DaikinOperationModes.FAN_ONLY);
    }
}
