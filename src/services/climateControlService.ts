import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { DaikinCloudAccessoryContext, DaikinCloudPlatform } from '../platform';
import { BaseService, DaikinOperationModes } from './baseService';
import { DaikinDeviceWrapper } from '../utils/DaikinDeviceWrapper';
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
        VERTICAL_SWING_MODE: 'Vertical swing',
        HORIZONTAL_SWING_MODE: 'Horizontal swing',
    };

    private readonly service?: Service;
    private readonly fanService?: Service;
    private readonly switchServicePowerfulMode?: Service;
    private readonly switchServiceEconoMode?: Service;
    private readonly switchServiceStreamerMode?: Service;
    private readonly switchServiceOutdoorSilentMode?: Service;
    private readonly switchServiceIndoorSilentMode?: Service;
    private readonly switchServiceDryOperationMode?: Service;
    private readonly switchServiceFanOnlyOperationMode?: Service;
    private readonly switchServiceVerticalSwingMode?: Service;
    private readonly switchServiceHorizontalSwingMode?: Service;

    public readonly wrapper: DaikinDeviceWrapper;
    public readonly handlers: ClimateControlHandlers;

    constructor(
        platform: DaikinCloudPlatform,
        accessory: PlatformAccessory<DaikinCloudAccessoryContext>,
        managementPointId: string,
    ) {
        super(platform, accessory, managementPointId);

        this.wrapper = new DaikinDeviceWrapper(this.accessory.context.device, this.managementPointId);
        this.handlers = new ClimateControlHandlers(
            this.platform,
            this.accessory.context.device,
            this.managementPointId,
            this.name,
            this.wrapper,
        );

        this.service = this.accessory.getService(this.platform.Service.HeaterCooler);
        this.fanService = this.accessory.getService(this.platform.Service.Fanv2);

        // ... (rest of switch services)

        this.service = this.service || this.accessory.addService(this.platform.Service.HeaterCooler);

        // ...

        // Fan Service Initialization
        const hasFanControl = this.wrapper.getData('fanControl', undefined);

        if (hasFanControl) {
            this.fanService =
                this.fanService || this.accessory.addService(this.platform.Service.Fanv2, 'Fan', 'fan_v2');

            this.fanService.setCharacteristic(this.platform.Characteristic.Name, 'Fan');

            this.fanService
                .getCharacteristic(this.platform.Characteristic.Active)
                .onGet(this.handlers.handleFanActiveGet.bind(this.handlers))
                .onSet(this.handlers.handleFanActiveSet.bind(this.handlers));

            this.fanService
                .getCharacteristic(this.platform.Characteristic.CurrentFanState)
                .onGet(this.handlers.handleFanCurrentStateGet.bind(this.handlers));

            this.fanService
                .getCharacteristic(this.platform.Characteristic.TargetFanState)
                .onGet(this.handlers.handleFanTargetStateGet.bind(this.handlers))
                .onSet(this.handlers.handleFanTargetStateSet.bind(this.handlers));

            this.fanService
                .getCharacteristic(this.platform.Characteristic.RotationSpeed)
                .setProps({
                    minValue: 0,
                    maxValue: 100,
                    minStep: 1,
                })
                .onGet(this.handlers.handleFanRotationSpeedGet.bind(this.handlers))
                .onSet(this.handlers.handleFanRotationSpeedSet.bind(this.handlers));
        } else {
            if (this.fanService) {
                this.accessory.removeService(this.fanService);
            }
        }

        // Cleanup old RotationSpeed from HeaterCooler
        if (this.service.testCharacteristic(this.platform.Characteristic.RotationSpeed)) {
            this.service.removeCharacteristic(
                this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed),
            );
        }

        // Removed: this.addOrUpdateCharacteristicRotationSpeed();
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

        // Update humidity
        const humidity = this.wrapper.getRoomHumidity();
        if (humidity !== null) {
            this.platform.daikinLogger.debug(
                `[${this.name}] Device supports Humidity, adding CurrentRelativeHumidity characteristic`,
            );
            this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity).updateValue(humidity);
            // .onGet() is handled by updateState pushing values, or we can add a getter if we want pull support
            // For now, let's rely on updateState pushing it, or add a simple getter.
            // Simple getter wrapping helper:
            // .onGet(() => this.wrapper.getRoomHumidity() ?? 0)
        } else {
            // If humidity is strictly not supported, we can remove it if it exists (cleanup)
            if (this.service.testCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)) {
                this.service.removeCharacteristic(
                    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity),
                );
            }
        }

        // Filter Maintenance Service
        const hasFilterData =
            this.accessory.context.device.getData(this.managementPointId, 'filterCleaningInterval', undefined) ||
            this.accessory.context.device.getData(this.managementPointId, 'filterSign', undefined);

        if (hasFilterData) {
            const filterService =
                this.accessory.getService(this.platform.Service.FilterMaintenance) ||
                this.accessory.addService(this.platform.Service.FilterMaintenance, 'Filter', 'filter_maintenance');

            filterService
                .getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
                .onGet(this.handlers.handleFilterChangeIndicationGet.bind(this.handlers));

            filterService
                .getCharacteristic(this.platform.Characteristic.FilterLifeLevel)
                .onGet(this.handlers.handleFilterLifeLevelGet.bind(this.handlers));
        }

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

        const roomTemperatureControlForCooling = this.wrapper.getData(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.COOLING}/setpoints/${this.wrapper.getSetpointType(DaikinOperationModes.COOLING)}`,
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

        const roomTemperatureControlForHeating = this.wrapper.getData(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.HEATING}/setpoints/${this.wrapper.getSetpointType(DaikinOperationModes.HEATING)}`,
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

        this.switchServiceVerticalSwingMode = this.accessory.getService(this.extraServices.VERTICAL_SWING_MODE);
        this.switchServiceHorizontalSwingMode = this.accessory.getService(this.extraServices.HORIZONTAL_SWING_MODE);

        this.service = this.service || this.accessory.addService(this.platform.Service.HeaterCooler);

        this.service.setCharacteristic(this.platform.Characteristic.Name, this.name);

        // Remove generic SwingMode if it exists from previous versions
        if (this.service.testCharacteristic(this.platform.Characteristic.SwingMode)) {
            this.service.removeCharacteristic(this.service.getCharacteristic(this.platform.Characteristic.SwingMode));
        }

        // ... (existing code for Active, Temperature, Humidity ...)

        // Vertical Swing
        if (this.wrapper.hasSwingModeVerticalFeature() && this.platform.config.showExtraFeatures) {
            this.switchServiceVerticalSwingMode =
                this.switchServiceVerticalSwingMode ||
                accessory.addService(
                    this.platform.Service.Switch,
                    this.extraServices.VERTICAL_SWING_MODE,
                    'vertical_swing_mode',
                );

            this.switchServiceVerticalSwingMode.setCharacteristic(
                this.platform.Characteristic.Name,
                this.extraServices.VERTICAL_SWING_MODE,
            );
            this.switchServiceVerticalSwingMode.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.switchServiceVerticalSwingMode.setCharacteristic(
                this.platform.Characteristic.ConfiguredName,
                this.extraServices.VERTICAL_SWING_MODE,
            );

            this.switchServiceVerticalSwingMode
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.handlers.handleVerticalSwingModeGet.bind(this.handlers))
                .onSet(this.handlers.handleVerticalSwingModeSet.bind(this.handlers));
        } else {
            if (this.switchServiceVerticalSwingMode) {
                accessory.removeService(this.switchServiceVerticalSwingMode);
            }
        }

        // Horizontal Swing
        if (this.wrapper.hasSwingModeHorizontalFeature() && this.platform.config.showExtraFeatures) {
            this.switchServiceHorizontalSwingMode =
                this.switchServiceHorizontalSwingMode ||
                accessory.addService(
                    this.platform.Service.Switch,
                    this.extraServices.HORIZONTAL_SWING_MODE,
                    'horizontal_swing_mode',
                );

            this.switchServiceHorizontalSwingMode.setCharacteristic(
                this.platform.Characteristic.Name,
                this.extraServices.HORIZONTAL_SWING_MODE,
            );
            this.switchServiceHorizontalSwingMode.addOptionalCharacteristic(
                this.platform.Characteristic.ConfiguredName,
            );
            this.switchServiceHorizontalSwingMode.setCharacteristic(
                this.platform.Characteristic.ConfiguredName,
                this.extraServices.HORIZONTAL_SWING_MODE,
            );

            this.switchServiceHorizontalSwingMode
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.handlers.handleHorizontalSwingModeGet.bind(this.handlers))
                .onSet(this.handlers.handleHorizontalSwingModeSet.bind(this.handlers));
        } else {
            if (this.switchServiceHorizontalSwingMode) {
                accessory.removeService(this.switchServiceHorizontalSwingMode);
            }
        }

        if (this.wrapper.hasPowerfulModeFeature() && this.platform.config.showExtraFeatures) {
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

        if (this.wrapper.hasEconoModeFeature() && this.platform.config.showExtraFeatures) {
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

        if (this.wrapper.hasStreamerModeFeature() && this.platform.config.showExtraFeatures) {
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

        if (this.wrapper.hasOutdoorSilentModeFeature() && this.platform.config.showExtraFeatures) {
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

        if (this.wrapper.hasIndoorSilentModeFeature() && this.platform.config.showExtraFeatures) {
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

        if (this.wrapper.hasDryOperationModeFeature() && this.platform.config.showExtraFeatures) {
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

        if (this.wrapper.hasFanOnlyOperationModeFeature() && this.platform.config.showExtraFeatures) {
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

            if (this.service.testCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)) {
                const humidity = this.wrapper.getRoomHumidity();
                if (humidity !== null) {
                    this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humidity);
                }
            }
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

            if (this.service.testCharacteristic(this.platform.Characteristic.SwingMode)) {
                this.service.removeCharacteristic(
                    this.service.getCharacteristic(this.platform.Characteristic.SwingMode),
                );
            }
        }

        if (this.fanService) {
            this.fanService.updateCharacteristic(
                this.platform.Characteristic.Active,
                await this.handlers.handleFanActiveGet(),
            );
            this.fanService.updateCharacteristic(
                this.platform.Characteristic.CurrentFanState,
                await this.handlers.handleFanCurrentStateGet(),
            );
            this.fanService.updateCharacteristic(
                this.platform.Characteristic.TargetFanState,
                await this.handlers.handleFanTargetStateGet(),
            );
            this.fanService.updateCharacteristic(
                this.platform.Characteristic.RotationSpeed,
                await this.handlers.handleFanRotationSpeedGet(),
            );
        }

        const filterService = this.accessory.getService(this.platform.Service.FilterMaintenance);
        if (filterService) {
            filterService.updateCharacteristic(
                this.platform.Characteristic.FilterChangeIndication,
                await this.handlers.handleFilterChangeIndicationGet(),
            );
            filterService.updateCharacteristic(
                this.platform.Characteristic.FilterLifeLevel,
                await this.handlers.handleFilterLifeLevelGet(),
            );
        }

        if (this.switchServiceVerticalSwingMode) {
            this.switchServiceVerticalSwingMode.updateCharacteristic(
                this.platform.Characteristic.On,
                await this.handlers.handleVerticalSwingModeGet(),
            );
        }

        if (this.switchServiceHorizontalSwingMode) {
            this.switchServiceHorizontalSwingMode.updateCharacteristic(
                this.platform.Characteristic.On,
                await this.handlers.handleHorizontalSwingModeGet(),
            );
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
