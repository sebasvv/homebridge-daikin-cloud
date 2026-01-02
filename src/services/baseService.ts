import { PlatformAccessory } from 'homebridge';
import { DaikinCloudAccessoryContext, DaikinCloudPlatform } from '../platform';
import { DaikinCloudRepo, DaikinDataPoint } from '../repositories/daikinCloudRepo';

export abstract class BaseService {
    constructor(
        protected readonly platform: DaikinCloudPlatform,
        protected readonly accessory: PlatformAccessory<DaikinCloudAccessoryContext>,
        protected readonly managementPointId: string,
    ) { }

    protected get name(): string {
        return this.accessory.displayName;
    }

    protected getData(key: string, path: string | undefined): DaikinDataPoint | undefined {
        return DaikinCloudRepo.getData(this.accessory.context.device, this.managementPointId, key, path);
    }

    protected safeGetValue<T = unknown>(key: string, path: string | undefined, defaultValue: T = 0 as unknown as T): T {
        return DaikinCloudRepo.safeGetValue<T>(
            this.accessory.context.device,
            this.managementPointId,
            key,
            path,
            defaultValue,
        );
    }

    protected async safeSetData(key: string, path: string | undefined, value: unknown) {
        try {
            await this.accessory.context.device.setData(
                this.managementPointId,
                key,
                path === undefined ? null : path,
                value,
            );
        } catch (e) {
            this.platform.daikinLogger.error(
                `[${this.name}] Failed to set ${key}${path ? ' ' + path : ''}`,
                e,
                JSON.stringify(
                    DaikinCloudRepo.maskSensitiveCloudDeviceData(this.accessory.context.device.desc),
                    null,
                    4,
                ),
            );
        }
    }
}

export enum DaikinOnOffModes {
    ON = 'on',
    OFF = 'off',
}

export enum DaikinOperationModes {
    FAN_ONLY = 'fanOnly',
    HEATING = 'heating',
    COOLING = 'cooling',
    AUTO = 'auto',
    DRY = 'dry',
}

export enum DaikinControlModes {
    ROOM_TEMPERATURE = 'roomTemperature',
    LEAVING_WATER_TEMPERATURE = 'leavingWaterTemperature',
    EXTERNAL_ROOM_TEMPERATURE = 'externalRoomTemperature',
}

export enum DaikinTemperatureControlSetpoints {
    ROOM_TEMPERATURE = 'roomTemperature',
    LEAVING_WATER_OFFSET = 'leavingWaterOffset',
    LEAVING_WATER_TEMPERATURE = 'leavingWaterTemperature',
}

export enum DaikinFanSpeedModes {
    QUIET = 'quiet',
    FIXED = 'fixed',
    AUTO = 'auto',
}

export enum DaikinFanDirectionHorizontalModes {
    STOP = 'stop',
    SWING = 'swing',
}

export enum DaikinFanDirectionVerticalModes {
    STOP = 'stop',
    SWING = 'swing',
    WIND_FREE = 'windFree',
}

export enum DaikinPowerfulModes {
    ON = 'on',
    OFF = 'off',
}

export enum DaikinOutdoorSilentModes {
    ON = 'on',
    OFF = 'off',
}

export enum DaikinStreamerModes {
    ON = 'on',
    OFF = 'off',
}

export enum DaikinEconoModes {
    ON = 'on',
    OFF = 'off',
}
