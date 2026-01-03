import { CharacteristicValue } from 'homebridge';
import { ClimateControlHelper } from './climateControlHelper';
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
        private readonly helper: ClimateControlHelper,
        private readonly forceUpdateDevices: () => void,
        private readonly addOrUpdateCharacteristicRotationSpeed: () => void,
    ) {}

    private async safeSetData(key: string, path: string | undefined, value: unknown) {
        try {
            await this.device.setData(this.managementPointId, key, path === undefined ? null : path, value);
        } catch (e) {
            this.platform.daikinLogger.error(
                `[${this.name}] Error setting data for ${key} (path: ${path}, value: ${JSON.stringify(value)}): ${e}`,
            );
        }
    }

    private safeGetValue<T = unknown>(key: string, path: string | undefined, defaultValue: T = 0 as unknown as T): T {
        return this.helper.safeGetValue<T>(key, path, defaultValue);
    }

    async handleActiveStateGet(): Promise<CharacteristicValue> {
        const state = this.safeGetValue<DaikinOnOffModes>('onOffMode', undefined);
        this.platform.daikinLogger.debug(
            `[${this.name}] GET ActiveState, state: ${state}, last update: ${this.device.getLastUpdated()}`,
        );
        return state === DaikinOnOffModes.ON;
    }

    async handleActiveStateSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET ActiveState, state: ${value}`);
        const state = value as boolean;
        await this.safeSetData('onOffMode', undefined, state ? DaikinOnOffModes.ON : DaikinOnOffModes.OFF);
        this.forceUpdateDevices();
    }

    async handleCurrentTemperatureGet(): Promise<CharacteristicValue> {
        const temperature = this.safeGetValue<number>('sensoryData', '/' + this.helper.getCurrentControlMode());
        this.platform.daikinLogger.debug(
            `[${this.name}] GET CurrentTemperature, temperature: ${temperature}, last update: ${this.device.getLastUpdated()}`,
        );
        return temperature;
    }

    async handleCoolingThresholdTemperatureGet(): Promise<CharacteristicValue> {
        const temperature = this.safeGetValue<number>(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.COOLING}/setpoints/${this.helper.getSetpoint(DaikinOperationModes.COOLING)}`,
        );
        this.platform.daikinLogger.debug(
            `[${this.name}] GET CoolingThresholdTemperature, temperature: ${temperature}, last update: ${this.device.getLastUpdated()}`,
        );
        return temperature;
    }

    async handleCoolingThresholdTemperatureSet(value: CharacteristicValue) {
        const temperature = Math.round((value as number) * 2) / 2;
        this.platform.daikinLogger.debug(
            `[${this.name}] SET CoolingThresholdTemperature, temperature to: ${temperature}`,
        );
        await this.safeSetData(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.COOLING}/setpoints/${this.helper.getSetpoint(DaikinOperationModes.COOLING)}`,
            temperature,
        );
        this.forceUpdateDevices();
    }

    async handleRotationSpeedGet(): Promise<CharacteristicValue> {
        const speed = this.safeGetValue<number>(
            'fanControl',
            `/operationModes/${this.helper.getCurrentOperationMode()}/fanSpeed/modes/fixed`,
        );
        this.platform.daikinLogger.debug(
            `[${this.name}] GET RotationSpeed, speed: ${speed}, last update: ${this.device.getLastUpdated()}`,
        );
        return speed;
    }

    async handleRotationSpeedSet(value: CharacteristicValue) {
        const speed = value as number;
        this.platform.daikinLogger.debug(`[${this.name}] SET RotationSpeed, speed to: ${speed}`);
        await this.safeSetData(
            'fanControl',
            `/operationModes/${this.helper.getCurrentOperationMode()}/fanSpeed/currentMode`,
            'fixed',
        );
        await this.safeSetData(
            'fanControl',
            `/operationModes/${this.helper.getCurrentOperationMode()}/fanSpeed/modes/fixed`,
            speed,
        );
        this.forceUpdateDevices();
    }

    async handleHeatingThresholdTemperatureGet(): Promise<CharacteristicValue> {
        const temperature = this.safeGetValue<number>(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.HEATING}/setpoints/${this.helper.getSetpoint(DaikinOperationModes.HEATING)}`,
        );
        this.platform.daikinLogger.debug(
            `[${this.name}] GET HeatingThresholdTemperature, temperature: ${temperature}, last update: ${this.device.getLastUpdated()}`,
        );
        return temperature;
    }

    async handleHeatingThresholdTemperatureSet(value: CharacteristicValue) {
        const temperature = Math.round((value as number) * 2) / 2;
        this.platform.daikinLogger.debug(
            `[${this.name}] SET HeatingThresholdTemperature, temperature to: ${temperature}`,
        );
        await this.safeSetData(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.HEATING}/setpoints/${this.helper.getSetpoint(DaikinOperationModes.HEATING)}`,
            temperature,
        );
        this.forceUpdateDevices();
    }

    async handleTargetHeaterCoolerStateGet(): Promise<CharacteristicValue> {
        const operationMode: DaikinOperationModes = this.helper.getCurrentOperationMode();
        this.platform.daikinLogger.debug(
            `[${this.name}] GET TargetHeaterCoolerState, operationMode: ${operationMode}, last update: ${this.device.getLastUpdated()}`,
        );

        switch (operationMode) {
            case DaikinOperationModes.COOLING:
                return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
            case DaikinOperationModes.HEATING:
                return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
            case DaikinOperationModes.DRY:
                this.addOrUpdateCharacteristicRotationSpeed();
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
        this.forceUpdateDevices();
    }

    async handleSwingModeSet(value: CharacteristicValue) {
        const swingMode = value as number;
        const daikinSwingMode =
            swingMode === 1 ? DaikinFanDirectionHorizontalModes.SWING : DaikinFanDirectionHorizontalModes.STOP;
        this.platform.daikinLogger.debug(`[${this.name}] SET SwingMode, swingmode to: ${swingMode}/${daikinSwingMode}`);

        if (this.helper.hasSwingModeHorizontalFeature()) {
            await this.safeSetData(
                'fanControl',
                `/operationModes/${this.helper.getCurrentOperationMode()}/fanDirection/horizontal/currentMode`,
                daikinSwingMode,
            );
        }

        if (this.helper.hasSwingModeVerticalFeature()) {
            await this.safeSetData(
                'fanControl',
                `/operationModes/${this.helper.getCurrentOperationMode()}/fanDirection/vertical/currentMode`,
                daikinSwingMode,
            );
        }

        this.forceUpdateDevices();
    }

    async handleSwingModeGet(): Promise<CharacteristicValue> {
        const verticalSwingMode = this.helper.hasSwingModeVerticalFeature()
            ? this.safeGetValue<string | null>(
                  'fanControl',
                  `/operationModes/${this.helper.getCurrentOperationMode()}/fanDirection/vertical/currentMode`,
                  null,
              )
            : null;
        const horizontalSwingMode = this.helper.hasSwingModeHorizontalFeature()
            ? this.safeGetValue<string | null>(
                  'fanControl',
                  `/operationModes/${this.helper.getCurrentOperationMode()}/fanDirection/horizontal/currentMode`,
                  null,
              )
            : null;
        this.platform.daikinLogger.debug(
            `[${this.name}] GET SwingMode, verticalSwingMode: ${verticalSwingMode}, last update: ${this.device.getLastUpdated()}`,
        );
        this.platform.daikinLogger.debug(
            `[${this.name}] GET SwingMode, horizontalSwingMode: ${horizontalSwingMode}, last update: ${this.device.getLastUpdated()}`,
        );

        if (
            horizontalSwingMode === DaikinFanDirectionHorizontalModes.STOP ||
            verticalSwingMode === DaikinFanDirectionVerticalModes.STOP
        ) {
            return this.platform.Characteristic.SwingMode.SWING_DISABLED;
        }

        return this.platform.Characteristic.SwingMode.SWING_ENABLED;
    }

    async handlePowerfulModeGet() {
        const powerfulModeOn =
            this.safeGetValue<DaikinPowerfulModes>('powerfulMode', undefined) === DaikinPowerfulModes.ON;
        this.platform.daikinLogger.debug(
            `[${this.name}] GET PowerfulMode, powerfulModeOn: ${powerfulModeOn}, last update: ${this.device.getLastUpdated()}`,
        );
        return powerfulModeOn;
    }

    async handlePowerfulModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET PowerfulMode to: ${value}`);
        const daikinPowerfulMode = (value as boolean) ? DaikinPowerfulModes.ON : DaikinPowerfulModes.OFF;
        await this.safeSetData('powerfulMode', undefined, daikinPowerfulMode);
        this.forceUpdateDevices();
    }

    async handleEconoModeGet() {
        const econoModeOn = this.safeGetValue<DaikinEconoModes>('econoMode', undefined) === DaikinEconoModes.ON;
        this.platform.daikinLogger.debug(
            `[${this.name}] GET EconoMode, econoModeOn: ${econoModeOn}, last update: ${this.device.getLastUpdated()}`,
        );
        return econoModeOn;
    }

    async handleEconoModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET EconoMode to: ${value}`);
        const daikinEconoMode = (value as boolean) ? DaikinEconoModes.ON : DaikinEconoModes.OFF;
        await this.safeSetData('econoMode', undefined, daikinEconoMode);
        this.forceUpdateDevices();
    }

    async handleStreamerModeGet() {
        const streamerModeOn =
            this.safeGetValue<DaikinStreamerModes>('streamerMode', undefined) === DaikinStreamerModes.ON;
        this.platform.daikinLogger.debug(
            `[${this.name}] GET StreamerMode, streamerModeOn: ${streamerModeOn}, last update: ${this.device.getLastUpdated()}`,
        );
        return streamerModeOn;
    }

    async handleStreamerModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET StreamerMode to: ${value}`);
        const daikinStreamerMode = (value as boolean) ? DaikinStreamerModes.ON : DaikinStreamerModes.OFF;
        await this.safeSetData('streamerMode', undefined, daikinStreamerMode);
        this.forceUpdateDevices();
    }

    async handleOutdoorSilentModeGet() {
        const outdoorSilentModeOn =
            this.safeGetValue<DaikinOutdoorSilentModes>('outdoorSilentMode', undefined) === DaikinOutdoorSilentModes.ON;
        this.platform.daikinLogger.debug(
            `[${this.name}] GET OutdoorSilentMode, outdoorSilentModeOn: ${outdoorSilentModeOn}, last update: ${this.device.getLastUpdated()}`,
        );
        return outdoorSilentModeOn;
    }

    async handleOutdoorSilentModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET OutdoorSilentMode to: ${value}`);
        const daikinOutdoorSilentMode = (value as boolean) ? DaikinOutdoorSilentModes.ON : DaikinOutdoorSilentModes.OFF;
        await this.safeSetData('outdoorSilentMode', undefined, daikinOutdoorSilentMode);
        this.forceUpdateDevices();
    }

    async handleIndoorSilentModeGet() {
        const indoorSilentModeOn =
            this.safeGetValue<DaikinFanSpeedModes>(
                'fanControl',
                `/operationModes/${this.helper.getCurrentOperationMode()}/fanSpeed/currentMode`,
            ) === DaikinFanSpeedModes.QUIET;
        this.platform.daikinLogger.debug(
            `[${this.name}] GET IndoorSilentMode, indoorSilentModeOn: ${indoorSilentModeOn}, last update: ${this.device.getLastUpdated()}`,
        );
        return indoorSilentModeOn;
    }

    async handleIndoorSilentModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET IndoorSilentMode to: ${value}`);
        const daikinFanSpeedMode = (value as boolean) ? DaikinFanSpeedModes.QUIET : DaikinFanSpeedModes.FIXED;
        await this.safeSetData(
            'fanControl',
            `/operationModes/${this.helper.getCurrentOperationMode()}/fanSpeed/currentMode`,
            daikinFanSpeedMode,
        );
        this.forceUpdateDevices();
    }

    async handleDryOperationModeGet() {
        const dryOperationModeOn =
            this.safeGetValue<DaikinOperationModes>('operationMode', undefined) === DaikinOperationModes.DRY;
        this.platform.daikinLogger.debug(
            `[${this.name}] GET DryOperationMode, dryOperationModeOn: ${dryOperationModeOn}, last update: ${this.device.getLastUpdated()}`,
        );

        return dryOperationModeOn;
    }

    async handleDryOperationModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET DryOperationMode to: ${value}`);
        const daikinOperationMode = (value as boolean) ? DaikinOperationModes.DRY : DaikinOperationModes.AUTO;
        await this.safeSetData('operationMode', undefined, daikinOperationMode);
        await this.safeSetData('onOffMode', undefined, (value as boolean) ? DaikinOnOffModes.ON : DaikinOnOffModes.OFF);
        this.forceUpdateDevices();
    }

    async handleFanOnlyOperationModeGet() {
        const fanOnlyOperationModeOn =
            this.safeGetValue<DaikinOperationModes>('operationMode', undefined) === DaikinOperationModes.FAN_ONLY;
        this.platform.daikinLogger.debug(
            `[${this.name}] GET FanOnlyOperationMode, fanOnlyOperationModeOn: ${fanOnlyOperationModeOn}, last update: ${this.device.getLastUpdated()}`,
        );
        return fanOnlyOperationModeOn;
    }

    async handleFanOnlyOperationModeSet(value: CharacteristicValue) {
        this.platform.daikinLogger.debug(`[${this.name}] SET FanOnlyOperationMode to: ${value}`);
        const daikinOperationMode = (value as boolean) ? DaikinOperationModes.FAN_ONLY : DaikinOperationModes.AUTO;
        await this.safeSetData('operationMode', undefined, daikinOperationMode);
        await this.safeSetData('onOffMode', undefined, (value as boolean) ? DaikinOnOffModes.ON : DaikinOnOffModes.OFF);
        this.forceUpdateDevices();
    }
}
