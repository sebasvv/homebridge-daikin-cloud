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

        this.service =
            this.accessory.getService(this.platform.Service.HeaterCooler) ||
            this.accessory.addService(this.platform.Service.HeaterCooler);

        this.service.setCharacteristic(this.platform.Characteristic.Name, this.name);

        // Required characteristics
        this.service
            .getCharacteristic(this.platform.Characteristic.Active)
            .onSet(this.handlers.handleActiveStateSet.bind(this.handlers))
            .onGet(this.handlers.handleActiveStateGet.bind(this.handlers));

        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.handlers.handleCurrentTemperatureGet.bind(this.handlers));

        this.service
            .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .setProps({
                minStep: 1,
                minValue: 0,
                maxValue: 2,
            })
            .onGet(this.handlers.handleTargetHeaterCoolerStateGet.bind(this.handlers))
            .onSet(this.handlers.handleTargetHeaterCoolerStateSet.bind(this.handlers));

        // Optional characteristics
        const humidity = this.wrapper.getRoomHumidity();
        if (humidity !== null) {
            this.platform.daikinLogger.debug(
                `[${this.name}] Device supports Humidity, adding CurrentRelativeHumidity characteristic`,
            );
            this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity).updateValue(humidity);
        } else if (this.service.testCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)) {
            this.service.removeCharacteristic(
                this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity),
            );
        }

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
        } else if (this.service.testCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)) {
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
        } else if (this.service.testCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)) {
            this.service.removeCharacteristic(
                this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature),
            );
        }

        // Remove generic SwingMode if it exists from previous versions
        if (this.service.testCharacteristic(this.platform.Characteristic.SwingMode)) {
            this.service.removeCharacteristic(this.service.getCharacteristic(this.platform.Characteristic.SwingMode));
        }

        // Cleanup old RotationSpeed from HeaterCooler (if it was added in previous versions)
        if (this.service.testCharacteristic(this.platform.Characteristic.RotationSpeed)) {
            this.service.removeCharacteristic(
                this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed),
            );
        }

        // Fan Service
        const hasFanControl = this.wrapper.getData('fanControl', undefined);
        this.fanService = this.accessory.getService(this.platform.Service.Fanv2);
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
        } else if (this.fanService) {
            this.accessory.removeService(this.fanService);
        }

        // Filter Maintenance Service
        const hasFilterData =
            this.accessory.context.device.getData(this.managementPointId, 'filterCleaningInterval', undefined) ||
            this.accessory.context.device.getData(this.managementPointId, 'filterSign', undefined);

        let filterService = this.accessory.getService(this.platform.Service.FilterMaintenance);
        if (hasFilterData) {
            filterService =
                filterService ||
                this.accessory.addService(this.platform.Service.FilterMaintenance, 'Filter', 'filter_maintenance');

            filterService
                .getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
                .onGet(this.handlers.handleFilterChangeIndicationGet.bind(this.handlers));

            filterService
                .getCharacteristic(this.platform.Characteristic.FilterLifeLevel)
                .onGet(this.handlers.handleFilterLifeLevelGet.bind(this.handlers));
        } else if (filterService) {
            this.accessory.removeService(filterService);
        }

        // Extra Features (Switches)
        this.switchServicePowerfulMode = this.setupSwitchService(
            this.extraServices.POWERFUL_MODE,
            'powerful_mode',
            this.wrapper.hasPowerfulModeFeature(),
            this.handlers.handlePowerfulModeGet.bind(this.handlers),
            this.handlers.handlePowerfulModeSet.bind(this.handlers),
        );

        this.switchServiceEconoMode = this.setupSwitchService(
            this.extraServices.ECONO_MODE,
            'econo_mode',
            this.wrapper.hasEconoModeFeature(),
            this.handlers.handleEconoModeGet.bind(this.handlers),
            this.handlers.handleEconoModeSet.bind(this.handlers),
        );

        this.switchServiceStreamerMode = this.setupSwitchService(
            this.extraServices.STREAMER_MODE,
            'streamer_mode',
            this.wrapper.hasStreamerModeFeature(),
            this.handlers.handleStreamerModeGet.bind(this.handlers),
            this.handlers.handleStreamerModeSet.bind(this.handlers),
        );

        this.switchServiceOutdoorSilentMode = this.setupSwitchService(
            this.extraServices.OUTDOUR_SILENT_MODE,
            'outdoor_silent_mode',
            this.wrapper.hasOutdoorSilentModeFeature(),
            this.handlers.handleOutdoorSilentModeGet.bind(this.handlers),
            this.handlers.handleOutdoorSilentModeSet.bind(this.handlers),
        );

        this.switchServiceIndoorSilentMode = this.setupSwitchService(
            this.extraServices.INDOOR_SILENT_MODE,
            'indoor_silent_mode',
            this.wrapper.hasIndoorSilentModeFeature(),
            this.handlers.handleIndoorSilentModeGet.bind(this.handlers),
            this.handlers.handleIndoorSilentModeSet.bind(this.handlers),
        );

        this.switchServiceDryOperationMode = this.setupSwitchService(
            this.extraServices.DRY_OPERATION_MODE,
            'dry_operation_mode',
            this.wrapper.hasDryOperationModeFeature(),
            this.handlers.handleDryOperationModeGet.bind(this.handlers),
            this.handlers.handleDryOperationModeSet.bind(this.handlers),
        );

        this.switchServiceFanOnlyOperationMode = this.setupSwitchService(
            this.extraServices.FAN_ONLY_OPERATION_MODE,
            'fan_only_operation_mode',
            this.wrapper.hasFanOnlyOperationModeFeature(),
            this.handlers.handleFanOnlyOperationModeGet.bind(this.handlers),
            this.handlers.handleFanOnlyOperationModeSet.bind(this.handlers),
        );

        this.switchServiceVerticalSwingMode = this.setupSwitchService(
            this.extraServices.VERTICAL_SWING_MODE,
            'vertical_swing_mode',
            this.wrapper.hasSwingModeVerticalFeature(),
            this.handlers.handleVerticalSwingModeGet.bind(this.handlers),
            this.handlers.handleVerticalSwingModeSet.bind(this.handlers),
        );

        this.switchServiceHorizontalSwingMode = this.setupSwitchService(
            this.extraServices.HORIZONTAL_SWING_MODE,
            'horizontal_swing_mode',
            this.wrapper.hasSwingModeHorizontalFeature(),
            this.handlers.handleHorizontalSwingModeGet.bind(this.handlers),
            this.handlers.handleHorizontalSwingModeSet.bind(this.handlers),
        );
    }

    private setupSwitchService(
        name: string,
        subtype: string,
        hasFeature: boolean,
        onGet: () => Promise<CharacteristicValue>,
        onSet: (value: CharacteristicValue) => Promise<void>,
    ): Service | undefined {
        let service = this.accessory.getService(name);

        if (hasFeature && this.platform.config.showExtraFeatures) {
            this.platform.daikinLogger.debug(`[${this.name}] Device has ${name}, add/update Switch Service`);

            service = service || this.accessory.addService(this.platform.Service.Switch, name, subtype);

            service.setCharacteristic(this.platform.Characteristic.Name, name);
            service.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            service.setCharacteristic(this.platform.Characteristic.ConfiguredName, name);

            service.getCharacteristic(this.platform.Characteristic.On).onGet(onGet).onSet(onSet);

            return service;
        } else {
            if (service) {
                this.accessory.removeService(service);
            }
            return undefined;
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
