import { ClimateControlService } from '../../src/services/climateControlService';
import { DaikinCloudPlatform, DaikinCloudAccessoryContext } from '../../src/platform';
import { PlatformAccessory, Service } from 'homebridge';
import { DaikinDeviceWrapper } from '../../src/utils/DaikinDeviceWrapper';
import { ClimateControlHandlers } from '../../src/services/climateControlHandlers';


jest.mock('../../src/utils/DaikinDeviceWrapper');
jest.mock('../../src/services/climateControlHandlers');

const mockLog = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockPlatform = {
    log: mockLog,
    daikinLogger: mockLog,
    Service: {
        HeaterCooler: 'HeaterCooler',
        Switch: 'SwitchService',
    },
    Characteristic: {
        Name: 'Name',
        ConfiguredName: 'ConfiguredName',
        Active: 'Active',
        CurrentTemperature: 'CurrentTemperature',
        TargetHeaterCoolerState: 'TargetHeaterCoolerState',
        CoolingThresholdTemperature: 'CoolingThresholdTemperature',
        HeatingThresholdTemperature: 'HeatingThresholdTemperature',
        RotationSpeed: 'RotationSpeed',
        SwingMode: 'SwingMode',
        On: 'On',
    },
    config: {
        showExtraFeatures: true,
    },
    forceUpdateDevices: jest.fn(),
} as unknown as DaikinCloudPlatform;

const mockDevice = {
    getLastUpdated: jest.fn(),
    getData: jest.fn(),
};

const mockAccessory = {
    context: {
        device: mockDevice,
    },
    getService: jest.fn(),
    addService: jest.fn(),
    removeService: jest.fn(),
} as unknown as PlatformAccessory<DaikinCloudAccessoryContext>;

const mockCharacteristic = {
    onGet: jest.fn().mockReturnThis(),
    onSet: jest.fn().mockReturnThis(),
    setProps: jest.fn().mockReturnThis(),
    updateValue: jest.fn().mockReturnThis(),
    removeOnSet: jest.fn().mockReturnThis(),
};

const mockService = {
    getCharacteristic: jest.fn().mockReturnValue(mockCharacteristic),
    setCharacteristic: jest.fn().mockReturnThis(),
    addOptionalCharacteristic: jest.fn().mockReturnThis(),
    removeCharacteristic: jest.fn().mockReturnThis(),
} as unknown as Service;

describe('ClimateControlService', () => {
    let service: ClimateControlService;

    beforeEach(() => {
        jest.clearAllMocks();
        (mockAccessory.getService as jest.Mock).mockReturnValue(undefined);
        (mockAccessory.addService as jest.Mock).mockReturnValue(mockService);
        (DaikinDeviceWrapper.prototype.getData as jest.Mock).mockReturnValue(undefined);
    });

    test('constructor sets up basics', () => {
        service = new ClimateControlService(mockPlatform, mockAccessory, 'mp-id');
        expect(mockAccessory.addService).toHaveBeenCalledWith('HeaterCooler');
        expect(mockService.getCharacteristic).toHaveBeenCalledWith('Active');
    });

    test('constructor uses existing service', () => {
        (mockAccessory.getService as jest.Mock).mockReturnValue(mockService);
        service = new ClimateControlService(mockPlatform, mockAccessory, 'mp-id');
        expect(mockAccessory.addService).not.toHaveBeenCalledWith('HeaterCooler');
    });

    test('removes services if features missing or showExtraFeatures false', () => {
        const platformNoExtra = { ...mockPlatform, config: { showExtraFeatures: false } } as any;
        (mockAccessory.getService as jest.Mock).mockImplementation((name) => {
            if (name === 'Powerful mode') return { name: 'Powerful' };
            return undefined;
        });

        new ClimateControlService(platformNoExtra, mockAccessory, 'mp-id');
        expect(mockAccessory.removeService).toHaveBeenCalled();
    });

    test('handles threshold temperatures if data present', () => {
        (DaikinDeviceWrapper.prototype.getData as jest.Mock).mockReturnValue({ value: 20, stepValue: 0.5 });
        service = new ClimateControlService(mockPlatform, mockAccessory, 'mp-id');
        expect(mockCharacteristic.setProps).toHaveBeenCalled();
    });

    test('removes threshold characteristics if data missing', () => {
        (DaikinDeviceWrapper.prototype.getData as jest.Mock).mockReturnValue(undefined);
        service = new ClimateControlService(mockPlatform, mockAccessory, 'mp-id');
        expect(mockService.removeCharacteristic).toHaveBeenCalledWith(mockCharacteristic);
    });

    describe('addOrUpdateCharacteristicRotationSpeed', () => {
        test('adds rotation speed if fanControl present', () => {
            (mockDevice.getData as jest.Mock).mockReturnValue({ value: 5 });
            service = new ClimateControlService(mockPlatform, mockAccessory, 'mp-id');
            expect(mockService.getCharacteristic).toHaveBeenCalledWith('RotationSpeed');
        });

        test('removes rotation speed if fanControl missing', () => {
            (mockDevice.getData as jest.Mock).mockReturnValue(undefined);
            service = new ClimateControlService(mockPlatform, mockAccessory, 'mp-id');
            expect(mockService.removeCharacteristic).toHaveBeenCalledWith(mockCharacteristic);
        });

        test('throws error if service not initialized', () => {
            // This is hard to trigger via normal constructor but we can try to force it
            const serviceAny = new ClimateControlService(mockPlatform, mockAccessory, 'mp-id') as any;
            serviceAny.service = undefined;
            expect(() => serviceAny.addOrUpdateCharacteristicRotationSpeed()).toThrow('Service not initialized');
        });
    });

    test('delegates calls to handlers', async () => {
        service = new ClimateControlService(mockPlatform, mockAccessory, 'mp-id');
        await service.handleActiveStateGet();
        expect(ClimateControlHandlers.prototype.handleActiveStateGet).toHaveBeenCalled();

        await service.handleActiveStateSet(true);
        expect(ClimateControlHandlers.prototype.handleActiveStateSet).toHaveBeenCalledWith(true);

        await service.handleCurrentTemperatureGet();
        expect(ClimateControlHandlers.prototype.handleCurrentTemperatureGet).toHaveBeenCalled();

        await service.handleCoolingThresholdTemperatureGet();
        expect(ClimateControlHandlers.prototype.handleCoolingThresholdTemperatureGet).toHaveBeenCalled();

        await service.handleCoolingThresholdTemperatureSet(25);
        expect(ClimateControlHandlers.prototype.handleCoolingThresholdTemperatureSet).toHaveBeenCalledWith(25);

        await service.handlers.handleFanRotationSpeedGet();
        expect(ClimateControlHandlers.prototype.handleFanRotationSpeedGet).toHaveBeenCalled();

        await service.handlers.handleFanRotationSpeedSet(50);
        expect(ClimateControlHandlers.prototype.handleFanRotationSpeedSet).toHaveBeenCalledWith(50);

        await service.handleHeatingThresholdTemperatureGet();
        expect(ClimateControlHandlers.prototype.handleHeatingThresholdTemperatureGet).toHaveBeenCalled();

        await service.handleHeatingThresholdTemperatureSet(20);
        expect(ClimateControlHandlers.prototype.handleHeatingThresholdTemperatureSet).toHaveBeenCalledWith(20);

        await service.handleTargetHeaterCoolerStateGet();
        expect(ClimateControlHandlers.prototype.handleTargetHeaterCoolerStateGet).toHaveBeenCalled();

        await service.handleTargetHeaterCoolerStateSet(1);
        expect(ClimateControlHandlers.prototype.handleTargetHeaterCoolerStateSet).toHaveBeenCalledWith(1);

        // Swing Mode logic refactored to separate switches, removing outdated HeaterCooler SwingMode tests
        // await service.handleSwingModeGet();
        // expect(ClimateControlHandlers.prototype.handleSwingModeGet).toHaveBeenCalled();

        await service.handlePowerfulModeGet();
        expect(ClimateControlHandlers.prototype.handlePowerfulModeGet).toHaveBeenCalled();

        await service.handlePowerfulModeSet(true);
        expect(ClimateControlHandlers.prototype.handlePowerfulModeSet).toHaveBeenCalledWith(true);

        await service.handleEconoModeGet();
        expect(ClimateControlHandlers.prototype.handleEconoModeGet).toHaveBeenCalled();

        await service.handleEconoModeSet(true);
        expect(ClimateControlHandlers.prototype.handleEconoModeSet).toHaveBeenCalledWith(true);

        await service.handleStreamerModeGet();
        expect(ClimateControlHandlers.prototype.handleStreamerModeGet).toHaveBeenCalled();

        await service.handleStreamerModeSet(true);
        expect(ClimateControlHandlers.prototype.handleStreamerModeSet).toHaveBeenCalledWith(true);

        await service.handleOutdoorSilentModeGet();
        expect(ClimateControlHandlers.prototype.handleOutdoorSilentModeGet).toHaveBeenCalled();

        await service.handleOutdoorSilentModeSet(true);
        expect(ClimateControlHandlers.prototype.handleOutdoorSilentModeSet).toHaveBeenCalledWith(true);

        await service.handleIndoorSilentModeGet();
        expect(ClimateControlHandlers.prototype.handleIndoorSilentModeGet).toHaveBeenCalled();

        await service.handleIndoorSilentModeSet(true);
        expect(ClimateControlHandlers.prototype.handleIndoorSilentModeSet).toHaveBeenCalledWith(true);

        await service.handleDryOperationModeGet();
        expect(ClimateControlHandlers.prototype.handleDryOperationModeGet).toHaveBeenCalled();

        await service.handleDryOperationModeSet(true);
        expect(ClimateControlHandlers.prototype.handleDryOperationModeSet).toHaveBeenCalledWith(true);

        await service.handleFanOnlyOperationModeGet();
        expect(ClimateControlHandlers.prototype.handleFanOnlyOperationModeGet).toHaveBeenCalled();

        await service.handleFanOnlyOperationModeSet(true);
        expect(ClimateControlHandlers.prototype.handleFanOnlyOperationModeSet).toHaveBeenCalledWith(true);
    });
});
