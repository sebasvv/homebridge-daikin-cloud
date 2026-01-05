import { API, PlatformAccessory } from 'homebridge';
import { APIService } from './APIService';
import { ConfigService } from './ConfigService';
import { DaikinLogger } from './logger';
import { DaikinCloudAccessoryContext } from '../types';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';
import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';
import { DaikinManagementPoint, DaikinCloudRepo } from '../repositories/daikinCloudRepo';
import { StringUtils } from '../utils/strings';
import { daikinAirConditioningAccessory } from '../accessories/daikinAirConditioningAccessory';
import { daikinAlthermaAccessory } from '../accessories/daikinAlthermaAccessory';

// We import the type dynamically or strictly if we can avoid circular issues.
// Ideally we would extract an interface "DaikinPlatformInterface" but 'any' works for the refactor step.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlatformInstance = any;

export class AccessoryManager {
    public readonly accessories: PlatformAccessory<DaikinCloudAccessoryContext>[] = [];

    constructor(
        private readonly api: API,
        private readonly daikinLogger: DaikinLogger,
        private readonly apiService: APIService,
        private readonly configService: ConfigService,
        private readonly platform: PlatformInstance,
    ) {}

    public configureAccessory(accessory: PlatformAccessory<DaikinCloudAccessoryContext>) {
        this.daikinLogger.info('[AccessoryManager] Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }

    public async syncAccessories() {
        const devices = await this.apiService.getCloudDevices();

        if (devices.length > 0) {
            await this.createDevices(devices);

            // Start regular updates
            // Convert updateIntervalInMinutes to milliseconds
            const updateIntervalMs = this.configService.props.updateIntervalInMinutes * 60 * 1000;
            this.apiService.startPolling(updateIntervalMs);
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

                if (this.isExcludedDevice(device.getId(), uuid)) {
                    this.daikinLogger.info(
                        `[AccessoryManager] Device with id ${uuid} is excluded, don't add accessory`,
                    );
                    if (existingAccessory) {
                        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
                        const index = this.accessories.indexOf(existingAccessory);
                        if (index > -1) {
                            this.accessories.splice(index, 1);
                        }
                    }
                    return;
                }

                if (existingAccessory) {
                    this.daikinLogger.info(
                        '[AccessoryManager] Restoring existing accessory from cache:',
                        existingAccessory.displayName,
                    );
                    existingAccessory.context.device = device;
                    this.api.updatePlatformAccessories([existingAccessory]);

                    this.instantiateAccessory(deviceModel, existingAccessory);
                } else {
                    const climateControlEmbeddedId = device.desc.managementPoints.find(
                        (mp: DaikinManagementPoint) => mp.managementPointType === 'climateControl',
                    )?.embeddedId;
                    const nameData = DaikinCloudRepo.getData(device, climateControlEmbeddedId, 'name', undefined);
                    const name: string = nameData ? (nameData.value as string) : '';

                    const displayName = StringUtils.isEmpty(name) ? deviceModel : name;

                    this.daikinLogger.info('[AccessoryManager] Adding new accessory, deviceModel:', displayName);

                    const accessory = new this.api.platformAccessory<DaikinCloudAccessoryContext>(displayName, uuid);
                    accessory.context.device = device;

                    this.instantiateAccessory(deviceModel, accessory);

                    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                    this.accessories.push(accessory);
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(error);

                if (error instanceof Error) {
                    this.daikinLogger.error(
                        `[AccessoryManager] Failed to create accessory from device: ${error.message}, device JSON: ${JSON.stringify(device)}`,
                    );
                }
            }
        });
    }

    private instantiateAccessory(deviceModel: string, accessory: PlatformAccessory<DaikinCloudAccessoryContext>) {
        if (deviceModel === 'Altherma') {
            new daikinAlthermaAccessory(this.platform, accessory);
        } else {
            new daikinAirConditioningAccessory(this.platform, accessory);
        }
    }

    private isExcludedDevice(deviceId: string, uuid: string): boolean {
        const excludedList = this.configService.props.excludedDevicesByDeviceId;
        if (!excludedList) {
            return false;
        }
        return excludedList.includes(deviceId) || excludedList.includes(uuid);
    }
}
