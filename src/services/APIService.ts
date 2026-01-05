import { DaikinCloudController } from 'daikin-controller-cloud';
import { OnectaClientConfig } from 'daikin-controller-cloud/dist/onecta/oidc-utils';
import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';
import { resolve } from 'node:path';
import { stat, unlink } from 'node:fs/promises';
import { DaikinLogger } from './logger';
import { ConfigService } from './ConfigService';
import { DaikinAPIError } from './DaikinAPIError';

export class APIService {
    public readonly controller: DaikinCloudController;
    private _lastUserInteraction: number = 0;
    private readonly IGNORE_POLL_WINDOW_MS = 15000; // 15 seconds debounce window
    private _pollingTimeout: NodeJS.Timeout | undefined;
    private _isPollingStopped: boolean = false;

    constructor(
        private readonly configService: ConfigService,
        private readonly daikinLogger: DaikinLogger,
        private readonly storagePath: string,
    ) {
        const daikinCloudControllerConfig: OnectaClientConfig = {
            oidcClientId: this.configService.props.clientId,
            oidcClientSecret: this.configService.props.clientSecret,
            oidcCallbackServerBindAddr: this.configService.props.oidcCallbackServerBindAddr,
            oidcCallbackServerExternalAddress: this.configService.props.callbackServerExternalAddress,
            oidcCallbackServerPort: this.configService.props.callbackServerPort,
            oidcTokenSetFilePath: resolve(this.storagePath, '.daikin-controller-cloud-tokenset'),
            oidcAuthorizationTimeoutS: 60 * 5,
        };

        this.checkTokenSet(daikinCloudControllerConfig);

        this.controller = new DaikinCloudController(daikinCloudControllerConfig);
        this.setupControllerListeners();
    }

    private checkTokenSet(config: OnectaClientConfig) {
        stat(config.oidcTokenSetFilePath!)
            .then((stats) => {
                this.daikinLogger.debug(
                    `[Config] TokenSet file exists, last modified: ${stats.mtime}, created: ${stats.birthtime}`,
                );
            })
            .catch(() => {
                this.daikinLogger.debug(
                    '[Config] TokenSet file does NOT YET exist, expect a message to start the authorisation flow',
                );
            });
    }

    private setupControllerListeners() {
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
                    this.stopPolling();
                } else if (rateLimitStatus.remainingDay <= 20) {
                    this.daikinLogger.warn(
                        `[Rate Limit] WARNING: Rate limit almost reached, you only have ${rateLimitStatus.remainingDay} calls left today`,
                    );
                }
            }
            this.daikinLogger.debug(
                `[Rate Limit] Remaining calls today: ${rateLimitStatus.remainingDay}/${rateLimitStatus.limitDay} -- this minute: ${rateLimitStatus.remainingMinute}/${rateLimitStatus.limitMinute}`,
            );

            // Sync local bucket with actual cloud status
            if (rateLimitStatus.remainingDay !== undefined) {
                this.requestBucket = rateLimitStatus.remainingDay;
            }
        });
    }

    private requestBucket: number = 200;

    public async waitForToken(): Promise<void> {
        if (this.requestBucket <= 0) {
            this.daikinLogger.warn('[Rate Limit] Request Bucket Empty. Blocking request to prevent API ban.');
            throw new Error('Rate Limit Exceeded: Daily limit reached.');
        }
        // We decrement locally. The 'rate_limit_status' event will correct us asynchronously.
        this.requestBucket--;
    }

    public async setDeviceData(
        device: DaikinCloudDevice,
        managementPointId: string,
        key: string,
        path: string | undefined,
        value: unknown,
    ): Promise<void> {
        await this.waitForToken();
        await device.setData(managementPointId, key, path, value);
    }

    public async getCloudDevices(): Promise<DaikinCloudDevice[]> {
        try {
            await this.waitForToken();
            return await this.controller.getCloudDevices();
        } catch (error) {
            let apiError = error;
            if (this.isHttpError(error)) {
                apiError = new DaikinAPIError(error.message, error.response?.status, error);
            }

            if (apiError instanceof DaikinAPIError) {
                this.daikinLogger.error(`[API Syncing] ${apiError.userMessage}`);
            } else if (error instanceof Error) {
                // Fallback for non-HTTP errors
                error.message = `[API Syncing] Failed to get cloud devices from Daikin Cloud: ${error.message}`;
                this.daikinLogger.error(error.message);

                if (error.message.includes('invalid_grant')) {
                    await this.onInvalidGrantError();
                }
            } else {
                this.daikinLogger.error(`[API Syncing] Unknown error: ${JSON.stringify(error)}`);
            }
            return [];
        }
    }

    public async updateAllDeviceData(force = false): Promise<void> {
        // Optimistic UI Logic: Debounce Updates
        if (!force && this.isDebouncing()) {
            this.daikinLogger.debug(
                '[APIService] Skipping cloud update due to recent user interaction (Optimistic UI Debounce)',
            );
            return;
        }

        try {
            await this.controller.updateAllDeviceData();
        } catch (error) {
            let apiError = error;
            if (this.isHttpError(error)) {
                apiError = new DaikinAPIError(error.message, error.response?.status, error);
            }

            if (apiError instanceof DaikinAPIError) {
                this.daikinLogger.error(`[API Syncing] Failed to update devices: ${apiError.userMessage}`);
            } else {
                this.daikinLogger.error(`[API Syncing] Failed to update devices data: ${JSON.stringify(error)}`);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private isHttpError(error: any): error is { message: string; response: { status: number } } {
        return error && typeof error === 'object' && 'response' in error && typeof error.response?.status === 'number';
    }

    public notifyUserInteraction() {
        this._lastUserInteraction = Date.now();
    }

    private isDebouncing(): boolean {
        return Date.now() - this._lastUserInteraction < this.IGNORE_POLL_WINDOW_MS;
    }

    private async onInvalidGrantError() {
        const tokenPath = resolve(this.storagePath, '.daikin-controller-cloud-tokenset');
        this.daikinLogger.warn('[API Syncing] TokenSet is invalid, removing TokenSet file');
        try {
            await unlink(tokenPath);
            this.daikinLogger.warn(
                '[API Syncing] TokenSet file is removed, restart Homebridge to restart the authorisation flow',
            );
        } catch (e) {
            this.daikinLogger.error(
                '[API Syncing] TokenSet file could not be removed, remove it manually. Location: ',
                tokenPath,
                e,
            );
        }
    }

    // Polling Management
    public startPolling(intervalMs: number) {
        this._isPollingStopped = false;
        this.scheduleNextUpdate(intervalMs);
    }

    public stopPolling() {
        this._isPollingStopped = true;
        if (this._pollingTimeout) {
            clearTimeout(this._pollingTimeout);
        }
    }

    private scheduleNextUpdate(intervalMs: number) {
        if (this._pollingTimeout) {
            clearTimeout(this._pollingTimeout);
        }

        if (this._isPollingStopped) {
            return;
        }

        const now = new Date();
        const hour = now.getHours();
        const isNightMode = hour >= 1 && hour < 5;

        // Use 4x the normal interval or at least 60 minutes during night mode
        const delay = isNightMode ? Math.max(intervalMs * 4, 60 * 60 * 1000) : intervalMs;

        if (isNightMode) {
            this.daikinLogger.debug(
                `[API Syncing] Night Mode active (01:00 - 05:00). Reducing polling frequency to every ${delay / 60000} minutes.`,
            );
        } else {
            this.daikinLogger.debug(`[API Syncing] Scheduling next update in ${delay / 60000} minutes`);
        }

        this._pollingTimeout = setTimeout(async () => {
            await this.updateAllDeviceData();
            this.scheduleNextUpdate(intervalMs);
        }, delay);
    }
}
