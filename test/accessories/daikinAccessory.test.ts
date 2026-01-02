import { daikinAccessory } from '../../src/accessories/daikinAccessory';
import { DaikinCloudPlatform, DaikinCloudAccessoryContext } from '../../src/platform';
import { PlatformAccessory } from 'homebridge';
import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';
import { DaikinLogger } from '../../src/services/logger';
import { DaikinCloudRepo } from '../../src/repositories/daikinCloudRepo';

// Mock dependencies
jest.mock('../../src/repositories/daikinCloudRepo');
const mockLog = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
} as unknown as DaikinLogger;

const mockPlatform = {
    daikinLogger: mockLog,
    Service: {
        AccessoryInformation: 'AccessoryInformation',
    },
    Characteristic: {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
    },
} as unknown as DaikinCloudPlatform;

// Concrete subclass for testing
class TestDaikinAccessory extends daikinAccessory {
    constructor(platform: DaikinCloudPlatform, accessory: PlatformAccessory<DaikinCloudAccessoryContext>) {
        super(platform, accessory);
    }
}

describe('daikinAccessory', () => {
    let mockAccessory: PlatformAccessory<DaikinCloudAccessoryContext>;
    let mockDevice: DaikinCloudDevice;

    beforeEach(() => {
        jest.clearAllMocks();

        mockDevice = {
            getId: jest.fn().mockReturnValue('device-id'),
            getLastUpdated: jest.fn().mockReturnValue('2023-01-01'),
            getDescription: jest.fn().mockReturnValue({ deviceModel: 'TestModel' }),
            getData: jest.fn(),
            desc: {
                managementPoints: [
                    {
                        embeddedId: 'gateway',
                        managementPointType: 'gateway',
                    },
                ],
            },
            on: jest.fn(),
        } as unknown as DaikinCloudDevice;

        const mockService = {
            setCharacteristic: jest.fn().mockReturnThis(),
        };

        mockAccessory = {
            UUID: 'uuid-123',
            displayName: 'Test Accessory',
            context: {
                device: mockDevice,
            },
            getService: jest.fn().mockReturnValue(mockService),
        } as unknown as PlatformAccessory<DaikinCloudAccessoryContext>;

        // Setup Repo mock
        (DaikinCloudRepo.safeGetValue as jest.Mock).mockImplementation((_device, _mpId, key) => {
            if (key === 'modelInfo') return 'GatewayModel';
            if (key === 'serialNumber') return 'Serial123';
            return 'UNKNOWN';
        });
    });

    test('should initialize and set characteristics', () => {
        new TestDaikinAccessory(mockPlatform, mockAccessory);

        expect(mockAccessory.getService).toHaveBeenCalledWith(mockPlatform.Service.AccessoryInformation);
        const service = mockAccessory.getService(mockPlatform.Service.AccessoryInformation);

        expect(service?.setCharacteristic).toHaveBeenCalledWith(mockPlatform.Characteristic.Manufacturer, 'Daikin');
        expect(service?.setCharacteristic).toHaveBeenCalledWith(mockPlatform.Characteristic.Model, 'GatewayModel');
        expect(service?.setCharacteristic).toHaveBeenCalledWith(mockPlatform.Characteristic.SerialNumber, 'Serial123');

        expect(mockPlatform.daikinLogger.info).toHaveBeenCalledWith(expect.stringContaining('Device found with id'));
    });

    test('should handle missing model and serial safely', () => {
        (DaikinCloudRepo.safeGetValue as jest.Mock).mockReturnValue('UNKNOWN_OR_NA');
        // Actually safeGetValue returns the default value passed to it.
        (DaikinCloudRepo.safeGetValue as jest.Mock).mockImplementation((_d, _m, key, _p, defaultValue) => defaultValue);

        new TestDaikinAccessory(mockPlatform, mockAccessory);

        const service = mockAccessory.getService(mockPlatform.Service.AccessoryInformation);
        expect(service?.setCharacteristic).toHaveBeenCalledWith(mockPlatform.Characteristic.Model, 'UNKNOWN');
        expect(service?.setCharacteristic).toHaveBeenCalledWith(mockPlatform.Characteristic.SerialNumber, 'NOT_AVAILABLE');
    });

    test('getEmbeddedIdByManagementPointType should return correctly for single match', () => {
        const accessory = new TestDaikinAccessory(mockPlatform, mockAccessory);
        const id = accessory.getEmbeddedIdByManagementPointType('gateway');
        expect(id).toBe('gateway');
    });

    test('getEmbeddedIdByManagementPointType should log error and return null for no match', () => {
        mockDevice.desc.managementPoints = []; // Empty
        const accessory = new TestDaikinAccessory(mockPlatform, mockAccessory);

        const id = accessory.getEmbeddedIdByManagementPointType('gateway');
        expect(id).toBeNull();
        expect(mockPlatform.daikinLogger.error).toHaveBeenCalledWith(expect.stringContaining('No management point found'));
    });

    test('getEmbeddedIdByManagementPointType should log warn and return null for multiple matches', () => {
        mockDevice.desc.managementPoints = [
            { embeddedId: 'gateway1', managementPointType: 'gateway' },
            { embeddedId: 'gateway2', managementPointType: 'gateway' },
        ];
        const accessory = new TestDaikinAccessory(mockPlatform, mockAccessory);

        const id = accessory.getEmbeddedIdByManagementPointType('gateway');
        expect(id).toBeNull();
        expect(mockPlatform.daikinLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Found more then one management point'));
    });

    test('should register update listener', () => {
        new TestDaikinAccessory(mockPlatform, mockAccessory);
        expect(mockDevice.on).toHaveBeenCalledWith('updated', expect.any(Function));

        // Trigger listener
        const listener = (mockDevice.on as jest.Mock).mock.calls[0][1];
        listener();
        expect(mockPlatform.daikinLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[API Syncing] Updated'));
    });
});
