import { DaikinCloudRepo } from '../../src/repositories/daikinCloudRepo';
import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';

describe('DaikinCloudRepo', () => {
    let mockDevice: DaikinCloudDevice;

    beforeEach(() => {
        mockDevice = {
            getData: jest.fn(),
        } as unknown as DaikinCloudDevice;
    });

    test('getData delegates to device', () => {
        (mockDevice.getData as jest.Mock).mockReturnValue({ value: 'test' });
        const result = DaikinCloudRepo.getData(mockDevice, 'mp', 'key', 'path');
        expect(result).toEqual({ value: 'test' });
        expect(mockDevice.getData).toHaveBeenCalledWith('mp', 'key', 'path');
    });

    test('safeGetValue returns value if present', () => {
        (mockDevice.getData as jest.Mock).mockReturnValue({ value: 'test' });
        const result = DaikinCloudRepo.safeGetValue(mockDevice, 'mp', 'key');
        expect(result).toBe('test');
    });

    test('safeGetValue returns default if data missing', () => {
        (mockDevice.getData as jest.Mock).mockReturnValue(undefined);
        const result = DaikinCloudRepo.safeGetValue(mockDevice, 'mp', 'key', undefined, 'def');
        expect(result).toBe('def');
    });

    test('safeGetValue returns default if value missing', () => {
        (mockDevice.getData as jest.Mock).mockReturnValue({ id: '1' });
        const result = DaikinCloudRepo.safeGetValue(mockDevice, 'mp', 'key', undefined, 'def');
        expect(result).toBe('def');
    });

    test('maskSensitiveCloudDeviceData masks all sensitive fields', () => {
        const details = {
            managementPoints: [
                {
                    managementPointType: 'gateway',
                    embeddedId: 'id',
                    ipAddress: { value: '1.2.3.4' },
                    macAddress: { value: 'AA:BB' },
                    ssid: { value: 'SSID' },
                    serialNumber: { value: 'SERIAL' },
                    wifiConnectionSSID: { value: 'WIFI' },
                    consumptionData: { some: 'data' },
                    schedule: { some: 'schedule' },
                    other: 'other',
                }
            ]
        };
        const masked = DaikinCloudRepo.maskSensitiveCloudDeviceData(details as any);
        const mp = masked.managementPoints?.[0];
        if (!mp) throw new Error('Management point not found');
        expect(mp.ipAddress?.value).toBe('REDACTED');
        expect(mp.macAddress?.value).toBe('REDACTED');
        expect(mp.ssid?.value).toBe('REDACTED');
        expect(mp.serialNumber?.value).toBe('REDACTED');
        expect(mp.wifiConnectionSSID?.value).toBe('REDACTED');
        expect(mp.consumptionData).toBe('REDACTED');
        expect(mp.schedule).toBe('REDACTED');
        expect(mp.other).toBe('other');
    });
});
