import { z } from 'zod';
import { PlatformConfig, Logger } from 'homebridge';
import { StringUtils } from '../utils/strings';

export const DaikinCloudPlatformConfigSchema = z.object({
    clientId: z.string().min(1, 'Client ID is required'),
    clientSecret: z.string().min(1, 'Client Secret is required'),
    callbackServerExternalAddress: z.string().min(1, 'Callback Server External Address is required'),
    callbackServerPort: z.coerce.number().default(8582),
    oidcCallbackServerBindAddr: z.string().default('127.0.0.1'),
    showExtraFeatures: z.boolean().default(false),
    excludedDevicesByDeviceId: z.array(z.string()).default([]),
    updateIntervalInMinutes: z.coerce.number().min(1).default(15),
    forceUpdateDelay: z.coerce.number().min(0).default(60000),
    // Platform required fields by Homebridge
    name: z.string().optional(),
    platform: z.string().optional(),
});

export type DaikinCloudPlatformConfig = z.infer<typeof DaikinCloudPlatformConfigSchema>;

export class ConfigService {
    private readonly _config: DaikinCloudPlatformConfig;

    constructor(
        rawConfig: PlatformConfig,
        private readonly log: Logger,
    ) {
        const result = DaikinCloudPlatformConfigSchema.safeParse(rawConfig);

        if (!result.success) {
            this.log.error('Invalid configuration:', result.error.format());
            throw new Error('Invalid Configuration: ' + JSON.stringify(result.error.format()));
        }

        this._config = result.data;
    }

    get props(): DaikinCloudPlatformConfig {
        return this._config;
    }

    public getPrivacyFriendlyConfig(): object {
        return {
            ...this._config,
            clientId: StringUtils.mask(this._config.clientId),
            clientSecret: StringUtils.mask(this._config.clientSecret),
            excludedDevicesByDeviceId: this._config.excludedDevicesByDeviceId.map((id) => StringUtils.mask(id)),
        };
    }
}
