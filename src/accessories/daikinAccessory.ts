import { PlatformAccessory } from 'homebridge';
import { DaikinCloudAccessoryContext, DaikinCloudPlatform } from '../platform';
import { DaikinCloudRepo, DaikinManagementPoint } from '../repositories/daikinCloudRepo';

export class daikinAccessory {
    readonly platform: DaikinCloudPlatform;
    readonly accessory: PlatformAccessory<DaikinCloudAccessoryContext>;
    public readonly gatewayManagementPointId: string | null;
    constructor(platform: DaikinCloudPlatform, accessory: PlatformAccessory<DaikinCloudAccessoryContext>) {
        this.platform = platform;
        this.accessory = accessory;
        this.gatewayManagementPointId = this.getEmbeddedIdByManagementPointType('gateway');

        this.printDeviceInfo();

        this.accessory
            .getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Daikin')
            .setCharacteristic(
                this.platform.Characteristic.Model,
                DaikinCloudRepo.safeGetValue(
                    accessory.context.device,
                    this.gatewayManagementPointId,
                    'modelInfo',
                    undefined,
                    'UNKNOWN',
                ),
            )
            .setCharacteristic(
                this.platform.Characteristic.SerialNumber,
                DaikinCloudRepo.safeGetValue(
                    accessory.context.device,
                    this.gatewayManagementPointId,
                    'serialNumber',
                    undefined,
                    'NOT_AVAILABLE',
                ),
            );

        this.accessory.context.device.on('updated', () => {
            this.platform.daikinLogger.debug(
                `[API Syncing] Updated ${this.accessory.displayName} (${this.accessory.UUID}), LastUpdated: ${this.accessory.context.device.getLastUpdated()}`,
            );
        });
    }

    printDeviceInfo() {
        this.platform.daikinLogger.info('[Platform] Device found with id: ' + this.accessory.UUID);
        this.platform.daikinLogger.info('[Platform]     id: ' + this.accessory.UUID);
        this.platform.daikinLogger.info('[Platform]     name: ' + this.accessory.displayName);
        this.platform.daikinLogger.info('[Platform]     last updated: ' + this.accessory.context.device.getLastUpdated());
        this.platform.daikinLogger.info(
            '[Platform]     modelInfo: ' +
            DaikinCloudRepo.safeGetValue(
                this.accessory.context.device,
                this.gatewayManagementPointId,
                'modelInfo',
                undefined,
            ),
        );
        this.platform.daikinLogger.info(
            '[Platform]     deviceModel: ' + this.accessory.context.device.getDescription().deviceModel,
        );
    }

    getEmbeddedIdByManagementPointType(managementPointType: string): string | null {
        const managementPoints = this.accessory.context.device.desc.managementPoints.filter(
            (managementPoint: DaikinManagementPoint) => managementPoint.managementPointType === managementPointType,
        );

        if (managementPoints.length === 0) {
            this.platform.daikinLogger.error(
                `[Platform] No management point found for managementPointType ${managementPointType}`,
            );
            return null;
        }

        if (managementPoints.length >= 2) {
            this.platform.daikinLogger.warn(
                `[Platform] Found more then one management point for managementPointType ${managementPointType}, we don't expect this, please open an issue on https://github.com/JeroenVdb/homebridge-daikin-cloud/issues`,
            );
            return null;
        }

        return managementPoints[0].embeddedId;
    }
}
