import { DaikinCloudPlatform, DaikinCloudAccessoryContext } from '../src/platform';
import { MockPlatformConfig } from './mocks';
import { daikinAirConditioningAccessory } from '../src/accessories/daikinAirConditioningAccessory';
import { daikinAlthermaAccessory } from '../src/accessories/daikinAlthermaAccessory';
import { HomebridgeAPI } from 'homebridge/lib/api.js';
import { Logger } from 'homebridge/lib/logger.js';
import { PlatformAccessory } from 'homebridge';
import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';

// Manual Mock for DaikinCloudController
jest.mock('daikin-controller-cloud', () => {
    const { EventEmitter } = require('events');
    return {
        DaikinCloudController: class extends EventEmitter {
            public getCloudDevices: jest.Mock;
            public updateAllDeviceData: jest.Mock;

            constructor() {
                super();
                this.getCloudDevices = jest.fn().mockResolvedValue([]);
                this.updateAllDeviceData = jest.fn();
            }
        },
    };
});

jest.mock('homebridge');
jest.mock('../src/accessories/daikinAirConditioningAccessory');
jest.mock('../src/accessories/daikinAlthermaAccessory');
jest.mock('daikin-controller-cloud/dist/device');

afterEach(() => {
    jest.clearAllMocks();
});

test('Initialize platform', async () => {
    const api = new HomebridgeAPI();
    const platform = new DaikinCloudPlatform(new Logger(), new MockPlatformConfig(), api);

    expect(platform).toBeDefined();
    expect(platform.updateIntervalDelay).toBe(900000);
});

test('DaikinCloudPlatform with new Aircondition accessory', (done) => {
    const api = new HomebridgeAPI();
    const registerPlatformAccessoriesSpy = jest.spyOn(api, 'registerPlatformAccessories');
    const platform = new DaikinCloudPlatform(new Logger(), new MockPlatformConfig(true), api);

    (platform.controller.getCloudDevices as jest.Mock).mockResolvedValue([{
        getId: () => 'MOCK_ID',
        getDescription: () => {
            return {
                deviceModel: 'Airco',
            };
        },
        getData: () => ({ value: 'MOCK_VALUE' }),
        desc: {
            managementPoints: [
                {
                    'embeddedId': 'climateControl',
                    'managementPointType': 'climateControl',
                },
            ],
        },
    } as unknown as DaikinCloudDevice]);

    api.signalFinished();

    setTimeout(() => {
        expect(daikinAirConditioningAccessory).toHaveBeenCalled();
        expect(daikinAlthermaAccessory).not.toHaveBeenCalled();
        expect(registerPlatformAccessoriesSpy).toHaveBeenCalledWith('homebridge-daikin-cloud', 'DaikinCloud', expect.anything());
        done();
    }, 10);
});

test('DaikinCloudPlatform with new Altherma accessory', (done) => {
    const api = new HomebridgeAPI();
    const registerPlatformAccessoriesSpy = jest.spyOn(api, 'registerPlatformAccessories');
    const platform = new DaikinCloudPlatform(new Logger(), new MockPlatformConfig(true), api);

    (platform.controller.getCloudDevices as jest.Mock).mockResolvedValue([{
        getId: () => 'MOCK_ID',
        getDescription: () => {
            return {
                deviceModel: 'Altherma',
            };
        },
        getData: () => ({ value: 'MOCK_VALUE' }),
        desc: {
            managementPoints: [
                {
                    'embeddedId': 'climateControl',
                    'managementPointType': 'climateControl',
                },
            ],
        },
    } as unknown as DaikinCloudDevice]);

    api.signalFinished();

    setTimeout(() => {
        expect(daikinAlthermaAccessory).toHaveBeenCalled();
        expect(daikinAirConditioningAccessory).not.toHaveBeenCalled();
        expect(registerPlatformAccessoriesSpy).toHaveBeenCalledWith('homebridge-daikin-cloud', 'DaikinCloud', expect.anything());
        done();
    }, 10);
});

test('Restore existing accessory', (done) => {
    const device = {
        getId: () => 'MOCK_ID',
        getDescription: () => ({ deviceModel: 'Airco' }),
        getData: () => ({ value: 'MOCK_VALUE' }),
        desc: { managementPoints: [] },
    } as unknown as DaikinCloudDevice;

    const api = new HomebridgeAPI();
    const platform = new DaikinCloudPlatform(new Logger(), new MockPlatformConfig(true), api);

    const accessory = new api.platformAccessory('Cached Accesssory', api.hap.uuid.generate('MOCK_ID')) as PlatformAccessory<DaikinCloudAccessoryContext>;
    accessory.context = { device: null } as unknown as DaikinCloudAccessoryContext;

    (platform.controller.getCloudDevices as jest.Mock).mockResolvedValue([device]);

    // Simulate restoring from cache
    platform.configureAccessory(accessory);

    api.signalFinished();

    setTimeout(() => {
        expect(daikinAirConditioningAccessory).toHaveBeenCalledWith(platform, accessory);
        expect(accessory.context.device).toBe(device);
        done();
    }, 10);
});

test('Handle excluded device', (done) => {
    const deviceId = 'EXCLUDED_ID';
    const device = {
        getId: () => deviceId,
        getDescription: () => ({ deviceModel: 'Airco' }),
        getData: () => ({ value: 'MOCK_VALUE' }),
        desc: { managementPoints: [] },
    } as unknown as DaikinCloudDevice;

    const api = new HomebridgeAPI();
    const config = new MockPlatformConfig(true);
    config.excludedDevicesByDeviceId = [api.hap.uuid.generate(deviceId)];

    const platform = new DaikinCloudPlatform(new Logger(), config, api);
    expect(platform).toBeDefined();
    const registerSpy = jest.spyOn(api, 'registerPlatformAccessories');

    (platform.controller.getCloudDevices as jest.Mock).mockResolvedValue([device]);

    api.signalFinished();

    setTimeout(() => {
        expect(registerSpy).not.toHaveBeenCalled();
        done();
    }, 10);
});

test('API Error handling (Generic)', (done) => {
    const api = new HomebridgeAPI();
    const logSpy = jest.spyOn(Logger.prototype, 'error');
    const platform = new DaikinCloudPlatform(new Logger(), new MockPlatformConfig(true), api);

    (platform.controller.getCloudDevices as jest.Mock).mockRejectedValue(new Error('Network Error'));

    api.signalFinished();

    setTimeout(() => {
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to get cloud devices'));
        done();
    }, 10);
});

test('Event handling: Authorization Request', (done) => {
    const api = new HomebridgeAPI();
    const logSpy = jest.spyOn(Logger.prototype, 'warn');
    const platform = new DaikinCloudPlatform(new Logger(), new MockPlatformConfig(true), api);

    (platform.controller.getCloudDevices as jest.Mock).mockResolvedValue([]);

    api.signalFinished();

    // Trigger event manually (since it's a real EventEmitter now!)
    platform.controller.emit('authorization_request', 'https://mock.url');

    setTimeout(() => {
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Please navigate to https://mock.url'));
        done();
    }, 10);
});

test('Event handling: Rate Limit', (done) => {
    const api = new HomebridgeAPI();
    const logSpy = jest.spyOn(Logger.prototype, 'warn');
    const debugSpy = jest.spyOn(Logger.prototype, 'debug');

    const platform = new DaikinCloudPlatform(new Logger(), new MockPlatformConfig(true), api);
    (platform.controller.getCloudDevices as jest.Mock).mockResolvedValue([]);

    api.signalFinished();

    platform.controller.emit('rate_limit_status', {
        remainingDay: 10,
        limitDay: 200,
        remainingMinute: 5,
        limitMinute: 10,
    });

    setTimeout(() => {
        // Warn if <= 20
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Rate limit almost reached'));
        // Debug always
        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Remaining calls today'));
        done();
    }, 10);
});

test('Invalid Grant Error Handling', (done) => {
    const error = new Error('invalid_grant');
    const api = new HomebridgeAPI();

    // Mock unlink to avoid actual file operations
    jest.mock('node:fs/promises', () => ({
        unlink: jest.fn().mockResolvedValue(undefined),
        stat: jest.fn().mockRejectedValue(new Error('No file')),
    }));

    const platform = new DaikinCloudPlatform(new Logger(), new MockPlatformConfig(true), api);
    expect(platform).toBeDefined();
    const logSpy = jest.spyOn(Logger.prototype, 'warn');

    (platform.controller.getCloudDevices as jest.Mock).mockRejectedValue(error);

    api.signalFinished();

    setTimeout(() => {
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('TokenSet is invalid'));
        done();
    }, 50);
});
