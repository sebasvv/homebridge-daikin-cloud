import { HotWaterTankService } from '../../src/services/hotWaterTankService';
import { DaikinCloudAccessoryContext, DaikinCloudPlatform } from '../../src/platform';
import { PlatformAccessory, Service } from 'homebridge';
import { DaikinOnOffModes, DaikinOperationModes } from '../../src/services/baseService';

const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockPlatform = {
    log: mockLogger,
    daikinLogger: mockLogger,
    Service: {
        Thermostat: 'ThermostatService',
        Switch: 'SwitchService',
    },
    Characteristic: {
        Name: 'Name',
        ConfiguredName: 'ConfiguredName',
        CurrentHeatingCoolingState: {
            OFF: 0,
            HEAT: 1,
        },
        TargetTemperature: 'TargetTemperature',
        TargetHeatingCoolingState: {
            OFF: 0,
            HEAT: 1,
            COOL: 2,
            AUTO: 3,
        },
        On: 'On',
    },
    config: {
        showExtraFeatures: true,
    },
    forceUpdateDevices: jest.fn(),
} as unknown as DaikinCloudPlatform;

const mockDevice = {
    getLastUpdated: jest.fn().mockReturnValue('2023-01-01'),
    getData: jest.fn(),
    setData: jest.fn(),
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
} as unknown as Service;

describe('HotWaterTankService', () => {
    let service: HotWaterTankService;

    beforeEach(() => {
        jest.clearAllMocks();
        (mockAccessory.getService as jest.Mock).mockReturnValue(undefined);
        (mockAccessory.addService as jest.Mock).mockReturnValue(mockService);
        (mockDevice.getData as jest.Mock).mockReturnValue({ value: 45, settable: true });
    });

    test('constructor sets up services', () => {
        service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');
        expect(mockAccessory.addService).toHaveBeenCalledWith('ThermostatService', 'Hot water tank', 'hot_water_tank');
    });

    test('constructor uses existing service if present', () => {
        (mockAccessory.getService as jest.Mock).mockReturnValue(mockService);
        service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');
        expect(mockAccessory.addService).not.toHaveBeenCalled();
    });

    test('constructor removes service if showExtraFeatures is false', () => {
        const platformNoExtra = { ...mockPlatform, config: { showExtraFeatures: false } } as any;
        const mockPowerfulService = { name: 'Powerful' } as any;
        (mockAccessory.getService as jest.Mock).mockReturnValueOnce(mockPowerfulService); // POWERFUL_MODE service exists

        new HotWaterTankService(platformNoExtra, mockAccessory, 'mp-id');
        expect(mockAccessory.removeService).toHaveBeenCalledWith(mockPowerfulService);
    });

    test('handleHotWaterTankCurrentHeatingCoolingStateGet', async () => {
        service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');
        (mockDevice.getData as jest.Mock).mockReturnValue({ value: DaikinOnOffModes.ON });
        expect(await service.handleHotWaterTankCurrentHeatingCoolingStateGet()).toBe(1); // HEAT

        (mockDevice.getData as jest.Mock).mockReturnValue({ value: DaikinOnOffModes.OFF });
        expect(await service.handleHotWaterTankCurrentHeatingCoolingStateGet()).toBe(0); // OFF
    });

    test('handleHotWaterTankHeatingTargetTemperatureSet rounds value', async () => {
        service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');
        await service.handleHotWaterTankHeatingTargetTemperatureSet(45.2); // Rounds to 45
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', expect.anything(), expect.anything(), 45);

        await service.handleHotWaterTankHeatingTargetTemperatureSet(45.3); // Rounds to 45.5
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', expect.anything(), expect.anything(), 45.5);
    });

    describe('TargetHeatingCoolingState', () => {
        test('GET returns expected values', async () => {
            service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');
            (mockDevice.getData as jest.Mock).mockImplementation((_mp, key) => {
                if (key === 'onOffMode') return { value: DaikinOnOffModes.OFF };
                return { value: DaikinOperationModes.HEATING };
            });
            expect(await service.handleHotWaterTankTargetHeatingCoolingStateGet()).toBe(0); // OFF

            (mockDevice.getData as jest.Mock).mockImplementation((_mp, key) => {
                if (key === 'onOffMode') return { value: DaikinOnOffModes.ON };
                if (key === 'operationMode') return { value: DaikinOperationModes.COOLING };
                return null;
            });
            expect(await service.handleHotWaterTankTargetHeatingCoolingStateGet()).toBe(2); // COOL

            (mockDevice.getData as jest.Mock).mockImplementation((_mp, key) => {
                if (key === 'onOffMode') return { value: DaikinOnOffModes.ON };
                if (key === 'operationMode') return { value: DaikinOperationModes.HEATING };
                return null;
            });
            expect(await service.handleHotWaterTankTargetHeatingCoolingStateGet()).toBe(1); // HEAT

            (mockDevice.getData as jest.Mock).mockImplementation((_mp, key) => {
                if (key === 'onOffMode') return { value: DaikinOnOffModes.ON };
                if (key === 'operationMode') return { value: DaikinOperationModes.AUTO };
                return null;
            });
            expect(await service.handleHotWaterTankTargetHeatingCoolingStateGet()).toBe(3); // AUTO
        });

        test('SET calls safeSetData for COOL, HEAT, AUTO', async () => {
            service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');

            await service.handleHotWaterTankTargetHeatingCoolingStateSet(2); // COOL
            expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', null, DaikinOperationModes.COOLING);

            await service.handleHotWaterTankTargetHeatingCoolingStateSet(1); // HEAT
            expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', null, DaikinOperationModes.HEATING);

            await service.handleHotWaterTankTargetHeatingCoolingStateSet(3); // AUTO
            expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', null, DaikinOperationModes.AUTO);
        });

        test('SET OFF turns device off', async () => {
            service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');
            await service.handleHotWaterTankTargetHeatingCoolingStateSet(0); // OFF
            expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'onOffMode', null, DaikinOnOffModes.OFF);
        });

        test('SET COOL/HEAT/AUTO maps correctly', async () => {
            service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');

            await service.handleHotWaterTankTargetHeatingCoolingStateSet(2); // COOL
            expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', null, DaikinOperationModes.COOLING);

            await service.handleHotWaterTankTargetHeatingCoolingStateSet(1); // HEAT
            expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', null, DaikinOperationModes.HEATING);

            await service.handleHotWaterTankTargetHeatingCoolingStateSet(3); // AUTO
            expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', null, DaikinOperationModes.AUTO);
        });
    });

    describe('getTargetHeatingCoolingStateProps with non-settable data', () => {
        test('returns restricted validValues for HEATING', () => {
            service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');
            (mockDevice.getData as jest.Mock).mockReturnValue({ value: DaikinOperationModes.HEATING, settable: false });
            const props = service.getTargetHeatingCoolingStateProps();
            expect(props.validValues).toContain(0); // OFF
            expect(props.validValues).toContain(1); // HEAT
            expect(props.validValues).not.toContain(2); // COOL
        });

        test('returns restricted validValues for COOLING', () => {
            service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');
            (mockDevice.getData as jest.Mock).mockReturnValue({ value: DaikinOperationModes.COOLING, settable: false });
            const props = service.getTargetHeatingCoolingStateProps();
            expect(props.validValues).toContain(2); // COOL
        });

        test('returns restricted validValues for AUTO', () => {
            service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');
            (mockDevice.getData as jest.Mock).mockReturnValue({ value: DaikinOperationModes.AUTO, settable: false });
            const props = service.getTargetHeatingCoolingStateProps();
            expect(props.validValues).toContain(3); // AUTO
        });
    });

    test('handlePowerfulModeGet/Set', async () => {
        service = new HotWaterTankService(mockPlatform, mockAccessory, 'mp-id');
        (mockDevice.getData as jest.Mock).mockReturnValue({ value: 'on' });
        expect(await service.handlePowerfulModeGet()).toBe(true);

        await service.handlePowerfulModeSet(false);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'powerfulMode', null, 'off');
    });
});
