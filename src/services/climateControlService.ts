import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { DaikinCloudAccessoryContext, DaikinCloudPlatform } from '../platform';
import { BaseService, DaikinOperationModes } from './baseService';
import { ClimateControlHelper } from './climateControlHelper';
import { ClimateControlHandlers } from './climateControlHandlers';

export class ClimateControlService extends BaseService {
    private extraServices = {
        POWERFUL_MODE: 'Powerful mode',
        ECONO_MODE: 'Econo mode',
        STREAMER_MODE: 'Streamer mode',
        OUTDOUR_SILENT_MODE: 'Outdoor silent mode',
        INDOOR_SILENT_MODE: 'Indoor silent mode',
        DRY_OPERATION_MODE: 'Dry operation mode',
        FAN_ONLY_OPERATION_MODE: 'Fan only operation mode',
    };

    private readonly service?: Service;
    private readonly switchServicePowerfulMode?: Service;
    private readonly switchServiceEconoMode?: Service;
    private readonly switchServiceStreamerMode?: Service;
    private readonly switchServiceOutdoorSilentMode?: Service;
    private readonly switchServiceIndoorSilentMode?: Service;
    private readonly switchServiceDryOperationMode?: Service;
    private readonly switchServiceFanOnlyOperationMode?: Service;

    private readonly helper: ClimateControlHelper;
    private readonly handlers: ClimateControlHandlers;

    constructor(
        platform: DaikinCloudPlatform,
        accessory: PlatformAccessory<DaikinCloudAccessoryContext>,
        managementPointId: string,
    ) {
        super(platform, accessory, managementPointId);

        this.helper = new ClimateControlHelper(
            this.platform,
            this.accessory.context.device,
            this.managementPointId,
            this.name,
        );
        this.handlers = new ClimateControlHandlers(
            this.platform,
            this.accessory.context.device,
            this.managementPointId,
            this.name,
            this.helper,
            () => this.platform.forceUpdateDevices(),
            () => this.addOrUpdateCharacteristicRotationSpeed(),
        );

        this.service = this.accessory.getService(this.platform.Service.HeaterCooler);
        this.switchServicePowerfulMode = this.accessory.getService(this.extraServices.POWERFUL_MODE);
        this.switchServiceEconoMode = this.accessory.getService(this.extraServices.ECONO_MODE);
        this.switchServiceStreamerMode = this.accessory.getService(this.extraServices.STREAMER_MODE);
        this.switchServiceOutdoorSilentMode = this.accessory.getService(this.extraServices.OUTDOUR_SILENT_MODE);
        this.switchServiceIndoorSilentMode = this.accessory.getService(this.extraServices.INDOOR_SILENT_MODE);
        this.switchServiceDryOperationMode = this.accessory.getService(this.extraServices.DRY_OPERATION_MODE);
        this.switchServiceFanOnlyOperationMode = this.accessory.getService(this.extraServices.FAN_ONLY_OPERATION_MODE);

        this.service = this.service || this.accessory.addService(this.platform.Service.HeaterCooler);

        this.service.setCharacteristic(this.platform.Characteristic.Name, this.name);

        // Required characteristic
        this.service
            .getCharacteristic(this.platform.Characteristic.Active)
            .onSet(this.handlers.handleActiveStateSet.bind(this.handlers))
            .onGet(this.handlers.handleActiveStateGet.bind(this.handlers));

        // Required characteristic
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.handlers.handleCurrentTemperatureGet.bind(this.handlers));

        // Required characteristic
        this.service
            .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .setProps({
                minStep: 1,
                minValue: 0,
                maxValue: 2,
            })
            .onGet(this.handlers.handleTargetHeaterCoolerStateGet.bind(this.handlers))
            .onSet(this.handlers.handleTargetHeaterCoolerStateSet.bind(this.handlers));

        const roomTemperatureControlForCooling = this.helper.getData(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.COOLING}/setpoints/${this.helper.getSetpoint(DaikinOperationModes.COOLING)}`,
        );
        if (roomTemperatureControlForCooling) {
            this.service
                .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
                .updateValue((roomTemperatureControlForCooling.value as CharacteristicValue) ?? 25)
                .setProps({
                    minStep: roomTemperatureControlForCooling.stepValue ?? 0.5,
                    minValue: roomTemperatureControlForCooling.minValue ?? 10,
                    maxValue: roomTemperatureControlForCooling.maxValue ?? 32,
                })
                .onGet(this.handlers.handleCoolingThresholdTemperatureGet.bind(this.handlers))
                .onSet(this.handlers.handleCoolingThresholdTemperatureSet.bind(this.handlers));
        } else {
            this.service.removeCharacteristic(
                this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature),
            );
        }

        const roomTemperatureControlForHeating = this.helper.getData(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.HEATING}/setpoints/${this.helper.getSetpoint(DaikinOperationModes.HEATING)}`,
        );
        if (roomTemperatureControlForHeating) {
            this.service
                .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
                .updateValue((roomTemperatureControlForHeating.value as CharacteristicValue) ?? 20)
                .setProps({
                    minStep: roomTemperatureControlForHeating.stepValue ?? 0.5,
                    minValue: roomTemperatureControlForHeating.minValue ?? 10,
                    maxValue: roomTemperatureControlForHeating.maxValue ?? 32,
                })
                .onGet(this.handlers.handleHeatingThresholdTemperatureGet.bind(this.handlers))
                .onSet(this.handlers.handleHeatingThresholdTemperatureSet.bind(this.handlers));
        } else {
            this.service.removeCharacteristic(
                this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature),
            );
        }

        this.addOrUpdateCharacteristicRotationSpeed();

        if (this.helper.hasSwingModeFeature()) {
            this.platform.daikinLogger.debug(`[${this.name}] Device has SwingMode, add Characteristic`);
            this.service
                .getCharacteristic(this.platform.Characteristic.SwingMode)
                .onGet(this.handlers.handleSwingModeGet.bind(this.handlers))
                .onSet(this.handlers.handleSwingModeSet.bind(this.handlers));
        }

        if (this.helper.hasPowerfulModeFeature() && this.platform.config.showExtraFeatures) {
            this.platform.daikinLogger.debug(`[${this.name}] Device has PowerfulMode, add Switch Service`);

            this.switchServicePowerfulMode =
                this.switchServicePowerfulMode ||
                accessory.addService(this.platform.Service.Switch, this.extraServices.POWERFUL_MODE, 'powerful_mode');
            this.switchServicePowerfulMode.setCharacteristic(
                this.platform.Characteristic.Name,
                this.extraServices.POWERFUL_MODE,
            );

            this.switchServicePowerfulMode.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.switchServicePowerfulMode.setCharacteristic(
                this.platform.Characteristic.ConfiguredName,
                this.extraServices.POWERFUL_MODE,
            );

            this.switchServicePowerfulMode
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.handlers.handlePowerfulModeGet.bind(this.handlers))
                .onSet(this.handlers.handlePowerfulModeSet.bind(this.handlers));
        } else {
            if (this.switchServicePowerfulMode) {
                accessory.removeService(this.switchServicePowerfulMode);
            }
        }

        if (this.helper.hasEconoModeFeature() && this.platform.config.showExtraFeatures) {
            this.platform.daikinLogger.debug(`[${this.name}] Device has EconoMode, add Switch Service`);

            this.switchServiceEconoMode =
                this.switchServiceEconoMode ||
                accessory.addService(this.platform.Service.Switch, this.extraServices.ECONO_MODE, 'econo_mode');
            this.switchServiceEconoMode.setCharacteristic(
                this.platform.Characteristic.Name,
                this.extraServices.ECONO_MODE,
            );

            this.switchServiceEconoMode.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.switchServiceEconoMode.setCharacteristic(
                this.platform.Characteristic.ConfiguredName,
                this.extraServices.ECONO_MODE,
            );

            this.switchServiceEconoMode
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.handlers.handleEconoModeGet.bind(this.handlers))
                .onSet(this.handlers.handleEconoModeSet.bind(this.handlers));
        } else {
            if (this.switchServiceEconoMode) {
                accessory.removeService(this.switchServiceEconoMode);
            }
        }

        if (this.helper.hasStreamerModeFeature() && this.platform.config.showExtraFeatures) {
            this.platform.daikinLogger.debug(`[${this.name}] Device has StreamerMode, add Switch Service`);

            this.switchServiceStreamerMode =
                this.switchServiceStreamerMode ||
                accessory.addService(this.platform.Service.Switch, this.extraServices.STREAMER_MODE, 'streamer_mode');
            this.switchServiceStreamerMode.setCharacteristic(
                this.platform.Characteristic.Name,
                this.extraServices.STREAMER_MODE,
            );

            this.switchServiceStreamerMode.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.switchServiceStreamerMode.setCharacteristic(
                this.platform.Characteristic.ConfiguredName,
                this.extraServices.STREAMER_MODE,
            );

            this.switchServiceStreamerMode
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.handlers.handleStreamerModeGet.bind(this.handlers))
                .onSet(this.handlers.handleStreamerModeSet.bind(this.handlers));
        } else {
            if (this.switchServiceStreamerMode) {
                accessory.removeService(this.switchServiceStreamerMode);
            }
        }

        if (this.helper.hasOutdoorSilentModeFeature() && this.platform.config.showExtraFeatures) {
            this.platform.daikinLogger.debug(`[${this.name}] Device has StreamerMode, add Switch Service`);

            this.switchServiceOutdoorSilentMode =
                this.switchServiceOutdoorSilentMode ||
                accessory.addService(
                    this.platform.Service.Switch,
                    this.extraServices.OUTDOUR_SILENT_MODE,
                    'outdoor_silent_mode',
                );
            this.switchServiceOutdoorSilentMode.setCharacteristic(
                this.platform.Characteristic.Name,
                this.extraServices.OUTDOUR_SILENT_MODE,
            );

            this.switchServiceOutdoorSilentMode.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.switchServiceOutdoorSilentMode.setCharacteristic(
                this.platform.Characteristic.ConfiguredName,
                this.extraServices.OUTDOUR_SILENT_MODE,
            );

            this.switchServiceOutdoorSilentMode
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.handlers.handleOutdoorSilentModeGet.bind(this.handlers))
                .onSet(this.handlers.handleOutdoorSilentModeSet.bind(this.handlers));
        } else {
            if (this.switchServiceOutdoorSilentMode) {
                accessory.removeService(this.switchServiceOutdoorSilentMode);
            }
        }

        if (this.helper.hasIndoorSilentModeFeature() && this.platform.config.showExtraFeatures) {
            this.platform.daikinLogger.debug(`[${this.name}] Device has IndoorSilentMode, add Switch Service`);

            this.switchServiceIndoorSilentMode =
                this.switchServiceIndoorSilentMode ||
                accessory.addService(
                    this.platform.Service.Switch,
                    this.extraServices.INDOOR_SILENT_MODE,
                    'indoor_silent_mode',
                );
            this.switchServiceIndoorSilentMode.setCharacteristic(
                this.platform.Characteristic.Name,
                this.extraServices.INDOOR_SILENT_MODE,
            );

            this.switchServiceIndoorSilentMode.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.switchServiceIndoorSilentMode.setCharacteristic(
                this.platform.Characteristic.ConfiguredName,
                this.extraServices.INDOOR_SILENT_MODE,
            );

            this.switchServiceIndoorSilentMode
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.handlers.handleIndoorSilentModeGet.bind(this.handlers))
                .onSet(this.handlers.handleIndoorSilentModeSet.bind(this.handlers));
        } else {
            if (this.switchServiceIndoorSilentMode) {
                accessory.removeService(this.switchServiceIndoorSilentMode);
            }
        }

        if (this.helper.hasDryOperationModeFeature() && this.platform.config.showExtraFeatures) {
            this.platform.daikinLogger.debug(`[${this.name}] Device has DryOperationMode, add Switch Service`);

            this.switchServiceDryOperationMode =
                this.switchServiceDryOperationMode ||
                accessory.addService(
                    this.platform.Service.Switch,
                    this.extraServices.DRY_OPERATION_MODE,
                    'dry_operation_mode',
                );
            this.switchServiceDryOperationMode.setCharacteristic(
                this.platform.Characteristic.Name,
                this.extraServices.DRY_OPERATION_MODE,
            );

            this.switchServiceDryOperationMode.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.switchServiceDryOperationMode.setCharacteristic(
                this.platform.Characteristic.ConfiguredName,
                this.extraServices.DRY_OPERATION_MODE,
            );

            this.switchServiceDryOperationMode
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.handlers.handleDryOperationModeGet.bind(this.handlers))
                .onSet(this.handlers.handleDryOperationModeSet.bind(this.handlers));
        } else {
            if (this.switchServiceDryOperationMode) {
                accessory.removeService(this.switchServiceDryOperationMode);
            }
        }

        if (this.helper.hasFanOnlyOperationModeFeature() && this.platform.config.showExtraFeatures) {
            this.platform.daikinLogger.debug(`[${this.name}] Device has FanOnlyOperationMode, add Switch Service`);

            this.switchServiceFanOnlyOperationMode =
                this.switchServiceFanOnlyOperationMode ||
                accessory.addService(
                    this.platform.Service.Switch,
                    this.extraServices.FAN_ONLY_OPERATION_MODE,
                    'fan_only_operation_mode',
                );
            this.switchServiceFanOnlyOperationMode.setCharacteristic(
                this.platform.Characteristic.Name,
                this.extraServices.FAN_ONLY_OPERATION_MODE,
            );

            this.switchServiceFanOnlyOperationMode.addOptionalCharacteristic(
                this.platform.Characteristic.ConfiguredName,
            );
            this.switchServiceFanOnlyOperationMode.setCharacteristic(
                this.platform.Characteristic.ConfiguredName,
                this.extraServices.FAN_ONLY_OPERATION_MODE,
            );

            this.switchServiceFanOnlyOperationMode
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.handlers.handleFanOnlyOperationModeGet.bind(this.handlers))
                .onSet(this.handlers.handleFanOnlyOperationModeSet.bind(this.handlers));
        } else {
            if (this.switchServiceFanOnlyOperationMode) {
                accessory.removeService(this.switchServiceFanOnlyOperationMode);
            }
        }
    }

    addOrUpdateCharacteristicRotationSpeed() {
        if (!this.service) {
            throw Error('Service not initialized');
        }

        const fanControl = this.accessory.context.device.getData(
            this.managementPointId,
            'fanControl',
            `/operationModes/${this.helper.getCurrentOperationMode()}/fanSpeed/modes/fixed`,
        );

        if (fanControl) {
            this.service
                .getCharacteristic(this.platform.Characteristic.RotationSpeed)
                .updateValue(fanControl.value ?? 1)
                .setProps({
                    minStep: fanControl.stepValue ?? 1,
                    minValue: fanControl.minValue ?? 1,
                    maxValue: fanControl.maxValue ?? 100,
                })
                .onGet(this.handlers.handleRotationSpeedGet.bind(this.handlers))
                .onSet(this.handlers.handleRotationSpeedSet.bind(this.handlers));
        } else {
            this.service.removeCharacteristic(
                this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed),
            );
        }
    }

    async handleActiveStateGet(): Promise<CharacteristicValue> {
        return this.handlers.handleActiveStateGet();
    }

    async handleActiveStateSet(value: CharacteristicValue) {
        return this.handlers.handleActiveStateSet(value);
    }

    async handleCurrentTemperatureGet(): Promise<CharacteristicValue> {
        return this.handlers.handleCurrentTemperatureGet();
    }

    async handleCoolingThresholdTemperatureGet(): Promise<CharacteristicValue> {
        return this.handlers.handleCoolingThresholdTemperatureGet();
    }

    async handleCoolingThresholdTemperatureSet(value: CharacteristicValue) {
        return this.handlers.handleCoolingThresholdTemperatureSet(value);
    }

    async handleRotationSpeedGet(): Promise<CharacteristicValue> {
        return this.handlers.handleRotationSpeedGet();
    }

    async handleRotationSpeedSet(value: CharacteristicValue) {
        return this.handlers.handleRotationSpeedSet(value);
    }

    async handleHeatingThresholdTemperatureGet(): Promise<CharacteristicValue> {
        return this.handlers.handleHeatingThresholdTemperatureGet();
    }

    async handleHeatingThresholdTemperatureSet(value: CharacteristicValue) {
        return this.handlers.handleHeatingThresholdTemperatureSet(value);
    }

    async handleTargetHeaterCoolerStateGet(): Promise<CharacteristicValue> {
        return this.handlers.handleTargetHeaterCoolerStateGet();
    }

    async handleTargetHeaterCoolerStateSet(value: CharacteristicValue) {
        return this.handlers.handleTargetHeaterCoolerStateSet(value);
    }

    async handleSwingModeSet(value: CharacteristicValue) {
        return this.handlers.handleSwingModeSet(value);
    }

    async handleSwingModeGet(): Promise<CharacteristicValue> {
        return this.handlers.handleSwingModeGet();
    }

    async handlePowerfulModeGet(): Promise<CharacteristicValue> {
        return this.handlers.handlePowerfulModeGet();
    }

    async handlePowerfulModeSet(value: CharacteristicValue) {
        return this.handlers.handlePowerfulModeSet(value);
    }

    async handleEconoModeGet(): Promise<CharacteristicValue> {
        return this.handlers.handleEconoModeGet();
    }

    async handleEconoModeSet(value: CharacteristicValue) {
        return this.handlers.handleEconoModeSet(value);
    }

    async handleStreamerModeGet(): Promise<CharacteristicValue> {
        return this.handlers.handleStreamerModeGet();
    }

    async handleStreamerModeSet(value: CharacteristicValue) {
        return this.handlers.handleStreamerModeSet(value);
    }

    async handleOutdoorSilentModeGet(): Promise<CharacteristicValue> {
        return this.handlers.handleOutdoorSilentModeGet();
    }

    async handleOutdoorSilentModeSet(value: CharacteristicValue) {
        return this.handlers.handleOutdoorSilentModeSet(value);
    }

    async handleIndoorSilentModeGet(): Promise<CharacteristicValue> {
        return this.handlers.handleIndoorSilentModeGet();
    }

    async handleIndoorSilentModeSet(value: CharacteristicValue) {
        return this.handlers.handleIndoorSilentModeSet(value);
    }

    async handleDryOperationModeGet(): Promise<CharacteristicValue> {
        return this.handlers.handleDryOperationModeGet();
    }

    async handleDryOperationModeSet(value: CharacteristicValue) {
        return this.handlers.handleDryOperationModeSet(value);
    }

    async handleFanOnlyOperationModeGet(): Promise<CharacteristicValue> {
        return this.handlers.handleFanOnlyOperationModeGet();
    }

    async handleFanOnlyOperationModeSet(value: CharacteristicValue) {
        return this.handlers.handleFanOnlyOperationModeSet(value);
    }

    async updateState() {
        if (this.service) {
            this.service.updateCharacteristic(
                this.platform.Characteristic.Active,
                await this.handlers.handleActiveStateGet(),
            );
            this.service.updateCharacteristic(
                this.platform.Characteristic.CurrentTemperature,
                await this.handlers.handleCurrentTemperatureGet(),
            );
            this.service.updateCharacteristic(
                this.platform.Characteristic.TargetHeaterCoolerState,
                await this.handlers.handleTargetHeaterCoolerStateGet(),
            );

            if (this.service.testCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)) {
                this.service.updateCharacteristic(
                    this.platform.Characteristic.CoolingThresholdTemperature,
                    await this.handlers.handleCoolingThresholdTemperatureGet(),
                );
            }
            if (this.service.testCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)) {
                this.service.updateCharacteristic(
                    this.platform.Characteristic.HeatingThresholdTemperature,
                    await this.handlers.handleHeatingThresholdTemperatureGet(),
                );
            }
            if (this.service.testCharacteristic(this.platform.Characteristic.RotationSpeed)) {
                this.service.updateCharacteristic(
                    this.platform.Characteristic.RotationSpeed,
                    await this.handlers.handleRotationSpeedGet(),
                );
            }
            if (this.service.testCharacteristic(this.platform.Characteristic.SwingMode)) {
                this.service.updateCharacteristic(
                    this.platform.Characteristic.SwingMode,
                    await this.handlers.handleSwingModeGet(),
                );
            }
        }

        if (this.switchServicePowerfulMode) {
            this.switchServicePowerfulMode.updateCharacteristic(
                this.platform.Characteristic.On,
                await this.handlers.handlePowerfulModeGet(),
            );
        }
        if (this.switchServiceEconoMode) {
            this.switchServiceEconoMode.updateCharacteristic(
                this.platform.Characteristic.On,
                await this.handlers.handleEconoModeGet(),
            );
        }
        if (this.switchServiceStreamerMode) {
            this.switchServiceStreamerMode.updateCharacteristic(
                this.platform.Characteristic.On,
                await this.handlers.handleStreamerModeGet(),
            );
        }
        if (this.switchServiceOutdoorSilentMode) {
            this.switchServiceOutdoorSilentMode.updateCharacteristic(
                this.platform.Characteristic.On,
                await this.handlers.handleOutdoorSilentModeGet(),
            );
        }
        if (this.switchServiceIndoorSilentMode) {
            this.switchServiceIndoorSilentMode.updateCharacteristic(
                this.platform.Characteristic.On,
                await this.handlers.handleIndoorSilentModeGet(),
            );
        }
        if (this.switchServiceDryOperationMode) {
            this.switchServiceDryOperationMode.updateCharacteristic(
                this.platform.Characteristic.On,
                await this.handlers.handleDryOperationModeGet(),
            );
        }
        if (this.switchServiceFanOnlyOperationMode) {
            this.switchServiceFanOnlyOperationMode.updateCharacteristic(
                this.platform.Characteristic.On,
                await this.handlers.handleFanOnlyOperationModeGet(),
            );
        }
    }
}
