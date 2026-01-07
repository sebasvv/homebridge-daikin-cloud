import { CharacteristicValue } from 'homebridge';
import { DaikinDeviceWrapper } from '../utils/DaikinDeviceWrapper';
import { DaikinCloudPlatform } from '../platform';
import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';
import {
    DaikinEconoModes,
    DaikinFanDirectionHorizontalModes,
    DaikinFanDirectionVerticalModes,
    DaikinFanSpeedModes,
    DaikinOnOffModes,
    DaikinOperationModes,
    DaikinOutdoorSilentModes,
    DaikinPowerfulModes,
    DaikinStreamerModes,
} from './baseService';

export class ClimateControlHandlers {
    constructor(
        private readonly platform: DaikinCloudPlatform,
        private readonly device: DaikinCloudDevice,
        private readonly managementPointId: string,
        private readonly name: string,
        private readonly wrapper: DaikinDeviceWrapper,
    ) {}

    private async safeSetData(key: string, path: string | undefined, value: unknown) {
        try {
            await this.platform.apiService.setDeviceData(this.device, this.managementPointId, key, path, value);
        } catch (e) {
            this.platform.daikinLogger.error(
                `[${this.name}] Error setting data for ${key} (path: ${path}, value: ${JSON.stringify(value)}): ${e}`,
            );
        }
    }

    private safeGetValue<T>(managementPoint: string, path: string | undefined, defaultValue?: T): T {
        return this.wrapper.safeGetValue<T>(managementPoint, path, defaultValue as T);
    }

    async handleFilterChangeIndicationGet(): Promise<CharacteristicValue> {
        const filterSign = this.safeGetValue<boolean>('filterSign', undefined, false);
        return filterSign
            ? this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER
            : this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
    }

    async handleFilterLifeLevelGet(): Promise<CharacteristicValue> {
        return 100;
    }

    async handleActiveStateGet(): Promise<CharacteristicValue> {
        const state = this.safeGetValue<DaikinOnOffModes>('onOffMode', undefined);
        return state === DaikinOnOffModes.ON;
    }

    async handleActiveStateSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET ActiveState, state: ${value}`);
        const state = value as boolean;
        await this.safeSetData('onOffMode', undefined, state ? DaikinOnOffModes.ON : DaikinOnOffModes.OFF);
        this.platform.apiService.notifyUserInteraction();
    }

    async handleCurrentTemperatureGet(): Promise<CharacteristicValue> {
        return this.safeGetValue<number>('sensoryData', '/' + this.wrapper.getCurrentControlMode());
    }

    async handleCoolingThresholdTemperatureGet(): Promise<CharacteristicValue> {
        return this.safeGetValue<number>(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.COOLING}/setpoints/${this.wrapper.getSetpointType(DaikinOperationModes.COOLING)}`,
        );
    }

    async handleCoolingThresholdTemperatureSet(value: CharacteristicValue) {
        const temperature = Math.round((value as number) * 2) / 2;
        this.platform.daikinLogger.debug(
            `[${this.name}] SET CoolingThresholdTemperature, temperature to: ${temperature}`,
        );
        await this.safeSetData(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.COOLING}/setpoints/${this.wrapper.getSetpointType(DaikinOperationModes.COOLING)}`,
            temperature,
        );
        this.platform.apiService.notifyUserInteraction();
    }

    async handleFanActiveGet(): Promise<CharacteristicValue> {
        return this.handleActiveStateGet();
    }

    async handleFanActiveSet(value: CharacteristicValue) {
        return this.handleActiveStateSet(value);
    }

    async handleFanCurrentStateGet(): Promise<CharacteristicValue> {
        const isActive = await this.handleActiveStateGet();
        if (!isActive) {
            return this.platform.Characteristic.CurrentFanState.INACTIVE;
        }
        return this.platform.Characteristic.CurrentFanState.BLOWING_AIR;
    }

    async handleFanTargetStateGet(): Promise<CharacteristicValue> {
        const fanSpeedMode = this.safeGetValue<string>(
            'fanControl',
            `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanSpeed/currentMode`,
            'fixed',
        );

        if (fanSpeedMode === 'auto') {
            return this.platform.Characteristic.TargetFanState.AUTO;
        }
        return this.platform.Characteristic.TargetFanState.MANUAL;
    }

    async handleFanTargetStateSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET FanTargetState to: ${value}`);
        const targetMode = value as number;

        let newDaikinMode = 'fixed';
        if (targetMode === this.platform.Characteristic.TargetFanState.AUTO) {
            newDaikinMode = 'auto';
        } else {
            newDaikinMode = 'fixed';
        }

        await this.safeSetData(
            'fanControl',
            `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanSpeed/currentMode`,
            newDaikinMode,
        );
        this.platform.apiService.notifyUserInteraction();
    }

    async handleFanRotationSpeedGet(): Promise<CharacteristicValue> {
        const currentMode = this.safeGetValue<string>(
            'fanControl',
            `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanSpeed/currentMode`,
        );

        if (currentMode === 'quiet') {
            return 15;
        }
        if (currentMode === 'auto') {
            return 50;
        }

        const daikinLevel = this.safeGetValue<number>(
            'fanControl',
            `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanSpeed/modes/fixed`,
            3,
        );

        switch (daikinLevel) {
            case 1:
                return 25;
            case 2:
                return 40;
            case 3:
                return 60;
            case 4:
                return 80;
            case 5:
                return 100;
            default:
                return 50;
        }
    }

    async handleFanRotationSpeedSet(value: CharacteristicValue) {
        const speed = value as number;
        this.platform.daikinLogger.debug(`[${this.name}] SET FanRotationSpeed, value: ${speed}`);

        let daikinMode = 'fixed';
        let daikinLevel = 3;

        if (speed <= 15) {
            daikinMode = 'quiet';
        } else if (speed <= 30) {
            daikinLevel = 1;
        } else if (speed <= 50) {
            daikinLevel = 2;
        } else if (speed <= 70) {
            daikinLevel = 3;
        } else if (speed <= 90) {
            daikinLevel = 4;
        } else {
            daikinLevel = 5;
        }

        await this.safeSetData(
            'fanControl',
            `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanSpeed/currentMode`,
            daikinMode,
        );

        if (daikinMode === 'fixed') {
            await this.safeSetData(
                'fanControl',
                `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanSpeed/modes/fixed`,
                daikinLevel,
            );
        }

        this.platform.apiService.notifyUserInteraction();
    }

    async handleHeatingThresholdTemperatureGet(): Promise<CharacteristicValue> {
        return this.safeGetValue<number>(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.HEATING}/setpoints/${this.wrapper.getSetpointType(DaikinOperationModes.HEATING)}`,
        );
    }

    async handleHeatingThresholdTemperatureSet(value: CharacteristicValue) {
        const temperature = Math.round((value as number) * 2) / 2;
        this.platform.daikinLogger.debug(
            `[${this.name}] SET HeatingThresholdTemperature, temperature to: ${temperature}`,
        );
        await this.safeSetData(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.HEATING}/setpoints/${this.wrapper.getSetpointType(DaikinOperationModes.HEATING)}`,
            temperature,
        );
        this.platform.apiService.notifyUserInteraction();
    }

    async handleTargetHeaterCoolerStateGet(): Promise<CharacteristicValue> {
        const operationMode: DaikinOperationModes = this.wrapper.getCurrentOperationMode();

        switch (operationMode) {
            case DaikinOperationModes.COOLING:
                return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
            case DaikinOperationModes.HEATING:
                return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
            case DaikinOperationModes.DRY:
                return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
            default:
                return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
        }
    }

    async handleTargetHeaterCoolerStateSet(value: CharacteristicValue) {
        const operationMode = value as number;
        this.platform.daikinLogger.debug(`[${this.name}] SET TargetHeaterCoolerState, OperationMode to: ${value}`);
        let daikinOperationMode: DaikinOperationModes = DaikinOperationModes.COOLING;

        switch (operationMode) {
            case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
                daikinOperationMode = DaikinOperationModes.COOLING;
                break;
            case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
                daikinOperationMode = DaikinOperationModes.HEATING;
                break;
            case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
                daikinOperationMode = DaikinOperationModes.AUTO;
                break;
        }

        this.platform.daikinLogger.debug(
            `[${this.name}] SET TargetHeaterCoolerState, daikinOperationMode to: ${daikinOperationMode}`,
        );
        await this.safeSetData('operationMode', undefined, daikinOperationMode);
        await this.safeSetData('onOffMode', undefined, DaikinOnOffModes.ON);
        this.platform.apiService.notifyUserInteraction();
    }

    async handleVerticalSwingModeGet(): Promise<CharacteristicValue> {
        const verticalSwingMode = this.safeGetValue<string | null>(
            'fanControl',
            `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanDirection/vertical/currentMode`,
            null,
        );
        return verticalSwingMode === DaikinFanDirectionVerticalModes.SWING;
    }

    async handleVerticalSwingModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET VerticalSwingMode to: ${value}`);
        const daikinSwingMode = (value as boolean)
            ? DaikinFanDirectionVerticalModes.SWING
            : DaikinFanDirectionVerticalModes.STOP;
        await this.safeSetData(
            'fanControl',
            `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanDirection/vertical/currentMode`,
            daikinSwingMode,
        );
        this.platform.apiService.notifyUserInteraction();
    }

    async handleHorizontalSwingModeGet(): Promise<CharacteristicValue> {
        const horizontalSwingMode = this.safeGetValue<string | null>(
            'fanControl',
            `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanDirection/horizontal/currentMode`,
            null,
        );
        return horizontalSwingMode === DaikinFanDirectionHorizontalModes.SWING;
    }

    async handleHorizontalSwingModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET HorizontalSwingMode to: ${value}`);
        const daikinSwingMode = (value as boolean)
            ? DaikinFanDirectionHorizontalModes.SWING
            : DaikinFanDirectionHorizontalModes.STOP;
        await this.safeSetData(
            'fanControl',
            `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanDirection/horizontal/currentMode`,
            daikinSwingMode,
        );
        this.platform.apiService.notifyUserInteraction();
    }

    async handlePowerfulModeGet() {
        return this.safeGetValue<DaikinPowerfulModes>('powerfulMode', undefined) === DaikinPowerfulModes.ON;
    }

    async handlePowerfulModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET PowerfulMode to: ${value}`);
        const daikinPowerfulMode = (value as boolean) ? DaikinPowerfulModes.ON : DaikinPowerfulModes.OFF;
        await this.safeSetData('powerfulMode', undefined, daikinPowerfulMode);
        this.platform.apiService.notifyUserInteraction();
    }

    async handleEconoModeGet() {
        return this.safeGetValue<DaikinEconoModes>('econoMode', undefined) === DaikinEconoModes.ON;
    }

    async handleEconoModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET EconoMode to: ${value}`);
        const daikinEconoMode = (value as boolean) ? DaikinEconoModes.ON : DaikinEconoModes.OFF;
        await this.safeSetData('econoMode', undefined, daikinEconoMode);
        this.platform.apiService.notifyUserInteraction();
    }

    async handleStreamerModeGet() {
        return this.safeGetValue<DaikinStreamerModes>('streamerMode', undefined) === DaikinStreamerModes.ON;
    }

    async handleStreamerModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET StreamerMode to: ${value}`);
        const daikinStreamerMode = (value as boolean) ? DaikinStreamerModes.ON : DaikinStreamerModes.OFF;
        await this.safeSetData('streamerMode', undefined, daikinStreamerMode);
        this.platform.apiService.notifyUserInteraction();
    }

    async handleOutdoorSilentModeGet() {
        return (
            this.safeGetValue<DaikinOutdoorSilentModes>('outdoorSilentMode', undefined) === DaikinOutdoorSilentModes.ON
        );
    }

    async handleOutdoorSilentModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET OutdoorSilentMode to: ${value}`);
        const daikinOutdoorSilentMode = (value as boolean) ? DaikinOutdoorSilentModes.ON : DaikinOutdoorSilentModes.OFF;
        await this.safeSetData('outdoorSilentMode', undefined, daikinOutdoorSilentMode);
        this.platform.apiService.notifyUserInteraction();
    }

    async handleIndoorSilentModeGet() {
        return (
            this.safeGetValue<DaikinFanSpeedModes>(
                'fanControl',
                `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanSpeed/currentMode`,
            ) === DaikinFanSpeedModes.QUIET
        );
    }

    async handleIndoorSilentModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET IndoorSilentMode to: ${value}`);
        const daikinFanSpeedMode = (value as boolean) ? DaikinFanSpeedModes.QUIET : DaikinFanSpeedModes.FIXED;
        await this.safeSetData(
            'fanControl',
            `/operationModes/${this.wrapper.getCurrentOperationMode()}/fanSpeed/currentMode`,
            daikinFanSpeedMode,
        );
        this.platform.apiService.notifyUserInteraction();
    }

    async handleDryOperationModeGet() {
        return this.safeGetValue<DaikinOperationModes>('operationMode', undefined) === DaikinOperationModes.DRY;
    }

    async handleDryOperationModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET DryOperationMode to: ${value}`);
        const daikinOperationMode = (value as boolean) ? DaikinOperationModes.DRY : DaikinOperationModes.AUTO;
        await this.safeSetData('operationMode', undefined, daikinOperationMode);
        await this.safeSetData('onOffMode', undefined, (value as boolean) ? DaikinOnOffModes.ON : DaikinOnOffModes.OFF);
        this.platform.apiService.notifyUserInteraction();
    }

    async handleFanOnlyOperationModeGet() {
        return this.safeGetValue<DaikinOperationModes>('operationMode', undefined) === DaikinOperationModes.FAN_ONLY;
    }

    async handleFanOnlyOperationModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET FanOnlyOperationMode to: ${value}`);
        const daikinOperationMode = (value as boolean) ? DaikinOperationModes.FAN_ONLY : DaikinOperationModes.AUTO;
        await this.safeSetData('operationMode', undefined, daikinOperationMode);
        await this.safeSetData('onOffMode', undefined, (value as boolean) ? DaikinOnOffModes.ON : DaikinOnOffModes.OFF);
        this.platform.apiService.notifyUserInteraction();
    }
}
