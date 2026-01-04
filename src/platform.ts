import {
    API,
    Characteristic,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { daikinAirConditioningAccessory } from './accessories/daikinAirConditioningAccessory';

import { DaikinCloudController } from 'daikin-controller-cloud';

import { daikinAlthermaAccessory } from './accessories/daikinAlthermaAccessory';
import { resolve } from 'node:path';
import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';
import { StringUtils } from './utils/strings';
import { OnectaClientConfig } from 'daikin-controller-cloud/dist/onecta/oidc-utils';

import { stat, unlink } from 'node:fs/promises';
import { DaikinCloudRepo, DaikinManagementPoint } from './repositories/daikinCloudRepo';
import { DaikinLogger } from './services/logger';
import { DaikinCloudPlatformConfig, DaikinCloudPlatformConfigSchema } from './config';

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND * 60;

export type DaikinCloudAccessoryContext = {
    device: DaikinCloudDevice;
};

export class DaikinCloudPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service;
    public readonly Characteristic: typeof Characteristic;

    public readonly accessories: PlatformAccessory<DaikinCloudAccessoryContext>[] = [];

    public readonly daikinLogger: DaikinLogger;
    public readonly storagePath: string = '';
    public controller: DaikinCloudController; // Assigned in constructor after validation

    public readonly updateIntervalDelay: number;
    public updateTimeout: NodeJS.Timeout | undefined;
    public forceUpdateTimeout: NodeJS.Timeout | undefined;

    // Use strict config type
    public readonly config: DaikinCloudPlatformConfig;

    constructor(
        public readonly log: Logger,
        rawConfig: PlatformConfig,
        public readonly api: API,
    ) {
        this.daikinLogger = new DaikinLogger(this.log, undefined, rawConfig.debug);
        this.daikinLogger.info('--- Daikin info for debugging reasons (enable Debug Mode for more logs) ---');

        this.daikinLogger.debug('[Platform] Initializing platform:', rawConfig.name);

        // Validate Config
        const result = DaikinCloudPlatformConfigSchema.safeParse(rawConfig);
        if (!result.success) {
            this.daikinLogger.error('Invalid configuration:', result.error.format());
            // Proceeding with invalid config is unsafe; strictly strictly we should throw,
            // but Homebridge plugins often try to survive. However, missing ClientID/Secret is fatal.
            // For now, let's assign a safe default or throw if criticals are missing.
            // Actually, safeParse logic implies we should likely abort or show a big error.
            throw new Error('Invalid Validation Configuration: ' + JSON.stringify(result.error.format()));
        }
        this.config = result.data;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.storagePath = api.user.storagePath();
        this.updateIntervalDelay = ONE_MINUTE * this.config.updateIntervalInMinutes;

        const daikinCloudControllerConfig: OnectaClientConfig = {
            oidcClientId: this.config.clientId,
            oidcClientSecret: this.config.clientSecret,
            oidcCallbackServerBindAddr: this.config.oidcCallbackServerBindAddr,
            oidcCallbackServerExternalAddress: this.config.callbackServerExternalAddress,
            oidcCallbackServerPort: this.config.callbackServerPort,
            oidcTokenSetFilePath: resolve(this.storagePath, '.daikin-controller-cloud-tokenset'),
            oidcAuthorizationTimeoutS: 60 * 5,
        };

        this.daikinLogger.debug('[Config] Homebridge config', this.getPrivacyFriendlyConfig(this.config));
        this.daikinLogger.debug(
            '[Config] DaikinCloudController config',
            this.getPrivacyFriendlyOnectaClientConfig(daikinCloudControllerConfig),
        );

        stat(daikinCloudControllerConfig.oidcTokenSetFilePath!)
            .then((stats) => {
                this.daikinLogger.debug(
                    `[Config] DaikinCloudController config, oidcTokenSetFile does exist, last modified: ${stats.mtime}, created: ${stats.birthtime}`,
                );
            })
            .catch(() => {
                this.daikinLogger.debug(
                    '[Config] DaikinCloudController config, oidcTokenSetFile does NOT YET exist, expect a message to start the authorisation flow',
                );
            });

        this.controller = new DaikinCloudController(daikinCloudControllerConfig);

        this.api.on('didFinishLaunching', async () => {
            this.controller.on('authorization_request', (url) => {
                this.daikinLogger.warn(`
                    Please navigate to ${url} to start the authorisation flow. If it is the first time you open this url you will need to accept a security warning.
                    
                    Important: Make sure your Daikin app Redirect URI is set to ${url} in the Daikin Developer Portal.
                `);
            });

            this.controller.on('rate_limit_status', (rateLimitStatus) => {
                if (rateLimitStatus.remainingDay !== undefined) {
                    if (rateLimitStatus.remainingDay <= 10) {
                        this.daikinLogger.error(
                            `[Rate Limit] CRITICAL: Only ${rateLimitStatus.remainingDay} calls left today. Stopping polling to preserve ability to control devices manually.`,
                        );
                        if (this.updateTimeout) {
                            clearTimeout(this.updateTimeout);
                        }
                    } else if (rateLimitStatus.remainingDay <= 20) {
                        this.daikinLogger.warn(
                            `[Rate Limit] WARNING: Rate limit almost reached, you only have ${rateLimitStatus.remainingDay} calls left today`,
                        );
                    }
                }
                this.daikinLogger.debug(
                    `[Rate Limit] Remaining calls today: ${rateLimitStatus.remainingDay}/${rateLimitStatus.limitDay} -- this minute: ${rateLimitStatus.remainingMinute}/${rateLimitStatus.limitMinute}`,
                );
            });

            const onInvalidGrantError = () => this.onInvalidGrantError(daikinCloudControllerConfig);
            const devices: DaikinCloudDevice[] = await this.discoverDevices(this.controller, onInvalidGrantError);

            if (devices.length > 0) {
                await this.createDevices(devices);
                this.startUpdateDevicesInterval();
            }

            this.daikinLogger.info('--------------- End Daikin info for debugging reasons --------------------');
        });
    }

    public configureAccessory(accessory: PlatformAccessory<DaikinCloudAccessoryContext>) {
        this.daikinLogger.info('[Platform] Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }

    private async discoverDevices(
        controller: DaikinCloudController,
        onInvalidGrantError: () => void,
    ): Promise<DaikinCloudDevice[]> {
        try {
            return await controller.getCloudDevices();
        } catch (error) {
            if (error instanceof Error) {
                error.message = `[API Syncing] Failed to get cloud devices from Daikin Cloud: ${error.message}`;
                this.daikinLogger.error(error.message);

                if (error.message.includes('invalid_grant')) {
                    onInvalidGrantError();
                }
            }
            return [];
        }
    }

    private async createDevices(devices: DaikinCloudDevice[]) {
        devices.forEach((device) => {
            try {
                const uuid = this.api.hap.uuid.generate(device.getId());
                const deviceModel: string = device.getDescription().deviceModel;

                const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);

                this.daikinLogger.debug(
                    'Create Device',
                    deviceModel,
                    JSON.stringify(DaikinCloudRepo.maskSensitiveCloudDeviceData(device.desc), null, 4),
                );

                if (this.isExcludedDevice(this.config.excludedDevicesByDeviceId, uuid)) {
                    this.daikinLogger.info(`[Platform] Device with id ${uuid} is excluded, don't add accessory`);
                    if (existingAccessory) {
                        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
                    }
                    return;
                }

                if (existingAccessory) {
                    this.daikinLogger.info(
                        '[Platform] Restoring existing accessory from cache:',
                        existingAccessory.displayName,
                    );
                    existingAccessory.context.device = device;
                    this.api.updatePlatformAccessories([existingAccessory]);

                    if (deviceModel === 'Altherma') {
                        new daikinAlthermaAccessory(this, existingAccessory);
                    } else {
                        new daikinAirConditioningAccessory(this, existingAccessory);
                    }
                } else {
                    const climateControlEmbeddedId = device.desc.managementPoints.find(
                        (mp: DaikinManagementPoint) => mp.managementPointType === 'climateControl',
                    )?.embeddedId;
                    const nameData = DaikinCloudRepo.getData(device, climateControlEmbeddedId, 'name', undefined);
                    const name: string = nameData ? (nameData.value as string) : '';
                    this.daikinLogger.info(
                        '[Platform] Adding new accessory, deviceModel:',
                        StringUtils.isEmpty(name) ? deviceModel : name,
                    );
                    const accessory = new this.api.platformAccessory<DaikinCloudAccessoryContext>(
                        StringUtils.isEmpty(name) ? deviceModel : name,
                        uuid,
                    );
                    accessory.context.device = device;

                    if (deviceModel === 'Altherma') {
                        new daikinAlthermaAccessory(this, accessory);
                    } else {
                        new daikinAirConditioningAccessory(this, accessory);
                    }

                    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(error);

                if (error instanceof Error) {
                    this.daikinLogger.error(
                        `[Platform] Failed to create HeaterCooler accessory from device, only HeaterCooler is supported at the moment: ${error.message}, device JSON: ${JSON.stringify(device)}`,
                    );
                }
            }
        });
    }

    private async updateDevices() {
        try {
            await this.controller.updateAllDeviceData();
        } catch (error) {
            this.daikinLogger.error(`[API Syncing] Failed to update devices data: ${JSON.stringify(error)}`);
        }
    }

    forceUpdateDevices(delay: number = this.config.forceUpdateDelay) {
        this.daikinLogger.debug(
            `[API Syncing] Force update devices data (delayed by ${delay}, update pending: ${this.forceUpdateTimeout || 'no update pending'})`,
        );

        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        clearTimeout(this.forceUpdateTimeout);

        this.forceUpdateTimeout = setTimeout(async () => {
            await this.updateDevices();
            this.scheduleNextUpdate();
        }, delay);
    }

    private scheduleNextUpdate() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        const now = new Date();
        const hour = now.getHours();
        const isNightMode = hour >= 1 && hour < 5;

        // Use 4x the normal interval or at least 60 minutes during night mode
        const delay = isNightMode ? Math.max(this.updateIntervalDelay * 4, 60 * 60 * 1000) : this.updateIntervalDelay;

        if (isNightMode) {
            this.daikinLogger.debug(
                `[API Syncing] Night Mode active (01:00 - 05:00). Reducing polling frequency to every ${delay / 60000} minutes.`,
            );
        } else {
            this.daikinLogger.debug(`[API Syncing] Scheduling next update in ${delay / ONE_MINUTE} minutes`);
        }

        this.updateTimeout = setTimeout(async () => {
            await this.updateDevices();
            this.scheduleNextUpdate();
        }, delay);
    }

    private startUpdateDevicesInterval() {
        this.scheduleNextUpdate();
    }

    private isExcludedDevice(excludedDevicesByDeviceId: Array<string>, deviceId: string): boolean {
        return typeof excludedDevicesByDeviceId !== 'undefined' && excludedDevicesByDeviceId.includes(deviceId);
    }

    private getPrivacyFriendlyConfig(config: DaikinCloudPlatformConfig): object {
        return {
            ...config,
            clientId: StringUtils.mask(config.clientId),
            clientSecret: StringUtils.mask(config.clientSecret),
            excludedDevicesByDeviceId: config.excludedDevicesByDeviceId
                ? config.excludedDevicesByDeviceId.map((deviceId: string) => StringUtils.mask(deviceId))
                : [],
        };
    }

    private getPrivacyFriendlyOnectaClientConfig(config: OnectaClientConfig): object {
        return {
            ...config,
            oidcClientId: StringUtils.mask(config.oidcClientId),
            oidcClientSecret: StringUtils.mask(config.oidcClientSecret),
        };
    }

    private async onInvalidGrantError(daikinCloudControllerConfig: OnectaClientConfig) {
        this.daikinLogger.warn('[API Syncing] TokenSet is invalid, removing TokenSet file');
        try {
            await unlink(daikinCloudControllerConfig.oidcTokenSetFilePath!);
            this.daikinLogger.warn(
                '[API Syncing] TokenSet file is removed, restart Homebridge to restart the authorisation flow',
            );
        } catch (e) {
            this.daikinLogger.error(
                '[API Syncing] TokenSet file could not be removed, remove it manually. Location: ',
                daikinCloudControllerConfig.oidcTokenSetFilePath,
                e,
            );
        }
    }
}
