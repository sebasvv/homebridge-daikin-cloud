import { PlatformAccessory } from 'homebridge';
import { DaikinCloudAccessoryContext, DaikinCloudPlatform } from '../platform';
import { daikinAccessory } from './daikinAccessory';
import { ClimateControlService } from '../services/climateControlService';

export class daikinAirConditioningAccessory extends daikinAccessory {
    service: ClimateControlService;

    constructor(platform: DaikinCloudPlatform, accessory: PlatformAccessory<DaikinCloudAccessoryContext>) {
        super(platform, accessory);
        const climateControlEmbeddedId = this.getEmbeddedIdByManagementPointType('climateControl');

        if (climateControlEmbeddedId === null) {
            throw new Error('No climate control management point found');
        }

        this.service = new ClimateControlService(this.platform, this.accessory, climateControlEmbeddedId);
    }

    protected updateState(): void {
        this.service.updateState();
    }
}
