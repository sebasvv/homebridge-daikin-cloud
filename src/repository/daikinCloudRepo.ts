import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';

export interface DaikinDataPoint {
    id: string;
    value: unknown;
    settable: boolean;
    stepValue?: number;
    minValue?: number;
    maxValue?: number;
    values?: string[];
    [key: string]: any;
}

export interface DaikinManagementPoint {
    managementPointType: string;
    embeddedId: string;
    ipAddress?: { value: string };
    macAddress?: { value: string };
    ssid?: { value: string };
    serialNumber?: { value: string };
    wifiConnectionSSID?: { value: string };
    consumptionData?: any;
    schedule?: any;
    [key: string]: any;
}

export interface DaikinCloudDeviceDetails {
    managementPoints: DaikinManagementPoint[];
    [key: string]: any;
}

export class DaikinCloudRepo {
    static getData(device: DaikinCloudDevice, managementPointId: string | null, key: string, path?: string): DaikinDataPoint | undefined {
        return device.getData(managementPointId, key, path);
    }

    static safeGetValue<T = unknown>(device: DaikinCloudDevice, managementPointId: string | null, key: string, path?: string, defaultValue: T = 0 as unknown as T): T {
        const data = this.getData(device, managementPointId, key, path);
        return (data && data.value !== undefined ? data.value : defaultValue) as T;
    }

    static maskSensitiveCloudDeviceData(cloudDeviceDetails: DaikinCloudDeviceDetails) {
        return {
            ...cloudDeviceDetails,
            managementPoints: cloudDeviceDetails.managementPoints.map(managementPoint => {
                const masked = { ...managementPoint };
                if (masked.ipAddress) masked.ipAddress.value = 'REDACTED';
                if (masked.macAddress) masked.macAddress.value = 'REDACTED';
                if (masked.ssid) masked.ssid.value = 'REDACTED';
                if (masked.serialNumber) masked.serialNumber.value = 'REDACTED';
                if (masked.wifiConnectionSSID) masked.wifiConnectionSSID.value = 'REDACTED';
                if (masked.consumptionData) masked.consumptionData = 'REDACTED';
                if (masked.schedule) masked.schedule = 'REDACTED';

                return masked;
            }),
        };
    }
}
