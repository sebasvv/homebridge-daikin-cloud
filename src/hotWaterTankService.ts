import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { DaikinCloudAccessoryContext, DaikinCloudPlatform } from './platform';
import { BaseService, DaikinOnOffModes, DaikinOperationModes, DaikinPowerfulModes } from './baseService';

export class HotWaterTankService extends BaseService {
    private extraServices = {
        POWERFUL_MODE: 'Powerful mode',
    };

    private readonly hotWaterTankService: Service;
    private readonly switchServicePowerfulMode?: Service;

    constructor(
        platform: DaikinCloudPlatform,
        accessory: PlatformAccessory<DaikinCloudAccessoryContext>,
        managementPointId: string,
    ) {
        super(platform, accessory, managementPointId);

        this.switchServicePowerfulMode = this.accessory.getService(this.extraServices.POWERFUL_MODE);

        this.hotWaterTankService = this.accessory.getService('Hot water tank') || accessory.addService(this.platform.Service.Thermostat, 'Hot water tank', 'hot_water_tank');
        this.hotWaterTankService.setCharacteristic(this.platform.Characteristic.Name, 'Hot water tank');

        this.hotWaterTankService
            .addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
        this.hotWaterTankService
            .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Hot water tank');

        this.hotWaterTankService.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
            .onGet(this.handleHotWaterTankCurrentHeatingCoolingStateGet.bind(this));

        this.hotWaterTankService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.handleHotWaterTankCurrentTemperatureGet.bind(this));

        const temperatureControl = this.getData('temperatureControl', '/operationModes/heating/setpoints/domesticHotWaterTemperature');
        const targetTemperature = this.hotWaterTankService.getCharacteristic(this.platform.Characteristic.TargetTemperature);
        if (temperatureControl) {
            targetTemperature
                .setProps({
                    minStep: temperatureControl.stepValue ?? 1,
                    minValue: temperatureControl.minValue ?? 10,
                    maxValue: temperatureControl.maxValue ?? 60,
                })
                .updateValue((temperatureControl.value as CharacteristicValue) ?? (temperatureControl.minValue ?? 45))
                .onGet(this.handleHotWaterTankHeatingTargetTemperatureGet.bind(this))
                .onSet(this.handleHotWaterTankHeatingTargetTemperatureSet.bind(this));
        }

        // remove the set handler if the temperature is not settable
        if (temperatureControl && temperatureControl.settable === false) {
            targetTemperature.removeOnSet();
        }

        this.hotWaterTankService.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
            .setProps(this.getTargetHeatingCoolingStateProps())
            .onGet(this.handleHotWaterTankTargetHeatingCoolingStateGet.bind(this))
            .onSet(this.handleHotWaterTankTargetHeatingCoolingStateSet.bind(this));

        if (this.hasPowerfulModeFeature() && this.platform.config.showExtraFeatures) {
            this.platform.log.debug(`[${this.name}] Device has PowerfulMode, add Switch Service`);

            this.switchServicePowerfulMode = this.switchServicePowerfulMode || accessory.addService(this.platform.Service.Switch, this.extraServices.POWERFUL_MODE, 'powerful_mode');
            this.switchServicePowerfulMode.setCharacteristic(this.platform.Characteristic.Name, this.extraServices.POWERFUL_MODE);

            this.switchServicePowerfulMode
                .addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.switchServicePowerfulMode
                .setCharacteristic(this.platform.Characteristic.ConfiguredName, this.extraServices.POWERFUL_MODE);

            this.switchServicePowerfulMode.getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.handlePowerfulModeGet.bind(this))
                .onSet(this.handlePowerfulModeSet.bind(this));

        } else {
            if (this.switchServicePowerfulMode) {
                accessory.removeService(this.switchServicePowerfulMode);
            }
        }

    }

    async handleHotWaterTankCurrentHeatingCoolingStateGet(): Promise<CharacteristicValue> {
        const state = this.safeGetValue('onOffMode', undefined);
        this.platform.log.debug(`[${this.name}] GET ActiveState, state: ${state}, last update: ${this.accessory.context.device.getLastUpdated()}`);
        const val = state === DaikinOnOffModes.ON ? this.platform.Characteristic.CurrentHeatingCoolingState.HEAT : this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
        this.platform.log.debug(`[${this.name}] GET ActiveState going to return ${val}`);
        return val;
    }

    async handleHotWaterTankCurrentTemperatureGet(): Promise<CharacteristicValue> {
        const temperature = this.safeGetValue<number>('sensoryData', '/tankTemperature');
        this.platform.log.debug(`[${this.name}] GET CurrentTemperature for hot water tank, temperature: ${temperature}`);
        return temperature;
    }

    async handleHotWaterTankHeatingTargetTemperatureGet(): Promise<CharacteristicValue> {
        const temperature = this.safeGetValue<number>('temperatureControl', '/operationModes/heating/setpoints/domesticHotWaterTemperature');
        this.platform.log.debug(`[${this.name}] GET HeatingThresholdTemperature domesticHotWaterTank, temperature: ${temperature}`);
        return temperature;
    }

    async handleHotWaterTankHeatingTargetTemperatureSet(value: CharacteristicValue) {
        const temperature = Math.round(value as number * 2) / 2;
        this.platform.log.debug(`[${this.name}] SET HeatingTargetTemperature domesticHotWaterTank, temperature to: ${temperature}`);
        // Removed the warning block as safeSetData should handle non-settable properties gracefully.
        await this.safeSetData('temperatureControl', '/operationModes/heating/setpoints/domesticHotWaterTemperature', temperature);
        this.platform.forceUpdateDevices();
    }

    async handleHotWaterTankTargetHeatingCoolingStateGet(): Promise<CharacteristicValue> {
        const operationMode: DaikinOperationModes = this.safeGetValue<DaikinOperationModes>('operationMode', undefined, DaikinOperationModes.AUTO);
        const state = this.safeGetValue('onOffMode', undefined);
        this.platform.log.debug(`[${this.name}] GET TankTargetHeatingCoolingState, operationMode: ${operationMode}, state: ${state}`);

        if (state === DaikinOnOffModes.OFF) {
            return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
        }

        switch (operationMode) {
            case DaikinOperationModes.COOLING:
                return this.platform.Characteristic.TargetHeatingCoolingState.COOL;
            case DaikinOperationModes.HEATING:
                return this.platform.Characteristic.TargetHeatingCoolingState.HEAT;
            default:
                return this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
        }
    }

    async handleHotWaterTankTargetHeatingCoolingStateSet(value: CharacteristicValue) {
        const operationMode = value as number;
        this.platform.log.debug(`[${this.name}] SET TargetHeatingCoolingState, OperationMode to: ${value}`);
        let daikinOperationMode: DaikinOperationModes = DaikinOperationModes.COOLING;

        if (operationMode === this.platform.Characteristic.TargetHeatingCoolingState.OFF) {
            await this.safeSetData('onOffMode', undefined, DaikinOnOffModes.OFF);
            return;
        }

        switch (operationMode) {
            case this.platform.Characteristic.TargetHeatingCoolingState.COOL:
                daikinOperationMode = DaikinOperationModes.COOLING;
                break;
            case this.platform.Characteristic.TargetHeatingCoolingState.HEAT:
                daikinOperationMode = DaikinOperationModes.HEATING;
                break;
            case this.platform.Characteristic.TargetHeatingCoolingState.AUTO:
                daikinOperationMode = DaikinOperationModes.AUTO;
                break;
        }

        this.platform.log.debug(`[${this.name}] SET TargetHeatingCoolingState, daikinOperationMode to: ${daikinOperationMode}`);

        // turn on the device as well because there is no specific on/off characteristic in Homebridge, while targetState/operationMode and onOffMode are separate with the Daikin API
        await this.safeSetData('onOffMode', undefined, DaikinOnOffModes.ON);
        await this.safeSetData('operationMode', undefined, daikinOperationMode);

        this.platform.forceUpdateDevices();
    }

    getTargetHeatingCoolingStateProps() {
        const operationModeData = this.getData('operationMode', undefined);
        this.platform.log.debug('OperationMode', JSON.stringify(operationModeData, null, 4));

        // Removed early return for non-settable operationModeData.
        // The validValues are now determined based on the current value if not settable,
        // otherwise, all options are available.
        if (operationModeData && operationModeData.settable === false) {
            if (operationModeData.value === DaikinOperationModes.HEATING) {
                return {
                    validValues: [this.platform.Characteristic.TargetHeatingCoolingState.OFF, this.platform.Characteristic.TargetHeatingCoolingState.HEAT],
                };
            } else if (operationModeData.value === DaikinOperationModes.COOLING) {
                return {
                    validValues: [this.platform.Characteristic.TargetHeatingCoolingState.OFF, this.platform.Characteristic.TargetHeatingCoolingState.COOL],
                };
            } else if (operationModeData.value === DaikinOperationModes.AUTO) {
                return {
                    validValues: [this.platform.Characteristic.TargetHeatingCoolingState.OFF, this.platform.Characteristic.TargetHeatingCoolingState.AUTO],
                };
            }
        }

        return {
            minValue: 0,
            maxValue: 3,
            minStep: 1,
        };
    }

    async handlePowerfulModeGet(): Promise<boolean> {
        const powerfulModeData = this.getData('powerfulMode', undefined);
        const powerfulModeOn = powerfulModeData?.value === DaikinPowerfulModes.ON;
        this.platform.log.debug(`[${this.name}] GET PowerfulMode, powerfulModeOn: ${powerfulModeOn}, last update: ${this.accessory.context.device.getLastUpdated()}`);
        return powerfulModeOn;
    }

    async handlePowerfulModeSet(value: CharacteristicValue) {
        this.platform.log.debug(`[${this.name}] SET PowerfulMode, powerful: ${value}`);
        await this.safeSetData('powerfulMode', undefined, value ? DaikinPowerfulModes.ON : DaikinPowerfulModes.OFF);
        this.platform.forceUpdateDevices();
    }

    hasPowerfulModeFeature(): boolean {
        return Boolean(this.getData('powerfulMode', undefined));
    }
}
