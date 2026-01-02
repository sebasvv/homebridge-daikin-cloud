import { z } from 'zod';

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
