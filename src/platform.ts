import {
    API,
    Characteristic,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
} from 'homebridge';
import { DaikinLogger } from './services/logger';
import { ConfigService, DaikinCloudPlatformConfig } from './services/ConfigService';
import { APIService } from './services/APIService';
import { AccessoryManager } from './services/AccessoryManager';
import { DaikinCloudAccessoryContext } from './types';
export { DaikinCloudAccessoryContext };

export class DaikinCloudPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service;
    public readonly Characteristic: typeof Characteristic;

    public readonly daikinLogger: DaikinLogger;
    public readonly configService: ConfigService;
    public readonly apiService: APIService;
    public readonly accessoryManager: AccessoryManager;

    constructor(
        public readonly log: Logger,
        rawConfig: PlatformConfig,
        public readonly api: API,
    ) {
        this.daikinLogger = new DaikinLogger(this.log, undefined, rawConfig.debug);

        try {
            this.configService = new ConfigService(rawConfig, this.log);
        } catch (e) {
            this.daikinLogger.error('Failed to initialize configuration service', e);
            throw e;
        }

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        this.apiService = new APIService(this.configService, this.daikinLogger, api.user.storagePath());
        this.accessoryManager = new AccessoryManager(
            this.api,
            this.daikinLogger,
            this.apiService,
            this.configService,
            this,
        );

        this.daikinLogger.info('--- Daikin Cloud Plugin Initialized ---');
        this.daikinLogger.debug(
            '[Platform] Config loaded:',
            JSON.stringify(this.configService.getPrivacyFriendlyConfig()),
        );

        this.api.on('didFinishLaunching', async () => {
            this.daikinLogger.debug('[Platform] Did Finish Launching');
            await this.accessoryManager.syncAccessories();
        });
    }

    public configureAccessory(accessory: PlatformAccessory<DaikinCloudAccessoryContext>) {
        this.accessoryManager.configureAccessory(accessory);
    }

    // Compatibility Getter for Accessories
    get config(): DaikinCloudPlatformConfig {
        return this.configService.props;
    }

    public forceUpdateDevices() {
        this.apiService.updateAllDeviceData(true);
    }
}
