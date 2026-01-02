import { ClimateControlHelper, DaikinSetpointModes } from '../../src/services/climateControlHelper';
import { DaikinCloudPlatform } from '../../src/platform';
import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';
import { DaikinCloudRepo } from '../../src/repositories/daikinCloudRepo';
import { DaikinControlModes, DaikinOperationModes, DaikinTemperatureControlSetpoints, DaikinFanSpeedModes } from '../../src/services/baseService';
import { DaikinLogger } from '../../src/services/logger';

// Mock dependencies
jest.mock('../../src/repositories/daikinCloudRepo');

const mockLog = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
} as unknown as DaikinLogger;

const mockPlatform = {
    daikinLogger: mockLog,
} as unknown as DaikinCloudPlatform;

const mockDevice = {
    desc: { managementPoints: [] },
} as unknown as DaikinCloudDevice;

describe('ClimateControlHelper', () => {
    let helper: ClimateControlHelper;

    beforeEach(() => {
        jest.clearAllMocks();
        helper = new ClimateControlHelper(mockPlatform, mockDevice, 'mp-id', 'Test Device');
    });

    test('safeGetValue delegates to repo', () => {
        (DaikinCloudRepo.safeGetValue as jest.Mock).mockReturnValue('mock-value');
        const result = helper.safeGetValue('key', 'path', 'default');
        expect(result).toBe('mock-value');
        expect(DaikinCloudRepo.safeGetValue).toHaveBeenCalledWith(mockDevice, 'mp-id', 'key', 'path', 'default');
    });

    test('getSetpointMode returns value or null', () => {
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue({ value: DaikinSetpointModes.FIXED });
        expect(helper.getSetpointMode()).toBe(DaikinSetpointModes.FIXED);

        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue(undefined);
        expect(helper.getSetpointMode()).toBeNull();
    });

    test('getCurrentControlMode defaults to ROOM_TEMPERATURE', () => {
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue(undefined);
        expect(helper.getCurrentControlMode()).toBe(DaikinControlModes.ROOM_TEMPERATURE);

        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue({ value: DaikinControlModes.LEAVING_WATER_TEMPERATURE });
        expect(helper.getCurrentControlMode()).toBe(DaikinControlModes.LEAVING_WATER_TEMPERATURE);
    });

    describe('getSetpoint', () => {
        beforeEach(() => {
            // Default setup
        });

        test('No setpointMode, returns based on controlMode', () => {
            jest.spyOn(helper, 'getSetpointMode').mockReturnValue(null);

            jest.spyOn(helper, 'getCurrentControlMode').mockReturnValue(DaikinControlModes.LEAVING_WATER_TEMPERATURE);
            expect(helper.getSetpoint(DaikinOperationModes.HEATING)).toBe(DaikinTemperatureControlSetpoints.LEAVING_WATER_OFFSET);

            jest.spyOn(helper, 'getCurrentControlMode').mockReturnValue(DaikinControlModes.ROOM_TEMPERATURE);
            expect(helper.getSetpoint(DaikinOperationModes.HEATING)).toBe(DaikinTemperatureControlSetpoints.ROOM_TEMPERATURE);
        });

        test('FIXED mode', () => {
            jest.spyOn(helper, 'getSetpointMode').mockReturnValue(DaikinSetpointModes.FIXED);

            jest.spyOn(helper, 'getCurrentControlMode').mockReturnValue(DaikinControlModes.LEAVING_WATER_TEMPERATURE);
            expect(helper.getSetpoint(DaikinOperationModes.HEATING)).toBe(DaikinTemperatureControlSetpoints.LEAVING_WATER_TEMPERATURE);

            jest.spyOn(helper, 'getCurrentControlMode').mockReturnValue(DaikinControlModes.ROOM_TEMPERATURE);
            expect(helper.getSetpoint(DaikinOperationModes.HEATING)).toBe(DaikinTemperatureControlSetpoints.ROOM_TEMPERATURE);
        });

        test('WEATHER_DEPENDENT mode', () => {
            jest.spyOn(helper, 'getSetpointMode').mockReturnValue(DaikinSetpointModes.WEATHER_DEPENDENT);

            jest.spyOn(helper, 'getCurrentControlMode').mockReturnValue(DaikinControlModes.LEAVING_WATER_TEMPERATURE);
            expect(helper.getSetpoint(DaikinOperationModes.HEATING)).toBe(DaikinTemperatureControlSetpoints.LEAVING_WATER_OFFSET);

            jest.spyOn(helper, 'getCurrentControlMode').mockReturnValue(DaikinControlModes.ROOM_TEMPERATURE);
            expect(helper.getSetpoint(DaikinOperationModes.HEATING)).toBe(DaikinTemperatureControlSetpoints.ROOM_TEMPERATURE);
        });

        test('WEATHER_DEPENDENT_HEATING_FIXED_COOLING mode', () => {
            jest.spyOn(helper, 'getSetpointMode').mockReturnValue(DaikinSetpointModes.WEATHER_DEPENDENT_HEATING_FIXED_COOLING);

            jest.spyOn(helper, 'getCurrentControlMode').mockReturnValue(DaikinControlModes.ROOM_TEMPERATURE);
            expect(helper.getSetpoint(DaikinOperationModes.HEATING)).toBe(DaikinTemperatureControlSetpoints.ROOM_TEMPERATURE);

            jest.spyOn(helper, 'getCurrentControlMode').mockReturnValue(DaikinControlModes.LEAVING_WATER_TEMPERATURE);
            expect(helper.getSetpoint(DaikinOperationModes.HEATING)).toBe(DaikinTemperatureControlSetpoints.LEAVING_WATER_OFFSET);
            expect(helper.getSetpoint(DaikinOperationModes.COOLING)).toBe(DaikinTemperatureControlSetpoints.LEAVING_WATER_TEMPERATURE);
        });

        test('Throw error for invalid combination', () => {
            jest.spyOn(helper, 'getSetpointMode').mockReturnValue(DaikinSetpointModes.WEATHER_DEPENDENT_HEATING_FIXED_COOLING);
            jest.spyOn(helper, 'getCurrentControlMode').mockReturnValue(DaikinControlModes.LEAVING_WATER_TEMPERATURE);
            // Operation mode not handled in switch/case if logic is tricky? 
            // Logic handles HEATING and COOLING. What about FAN_ONLY?
            expect(() => helper.getSetpoint(DaikinOperationModes.FAN_ONLY)).toThrow();
        });
    });

    test('hasSwingModeVerticalFeature true', () => {
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue({ value: 'vertical' }); // Truthy
        jest.spyOn(helper, 'getCurrentOperationMode').mockReturnValue(DaikinOperationModes.HEATING);
        expect(helper.hasSwingModeVerticalFeature()).toBe(true);
        expect(mockPlatform.daikinLogger.debug).toHaveBeenCalledWith(expect.stringContaining('hasSwingModeFeature, verticalSwing: true'));
    });

    test('hasIndoorSilentModeFeature false if no fan control', () => {
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue(undefined);
        expect(helper.hasIndoorSilentModeFeature()).toBe(false);
    });

    test('hasIndoorSilentModeFeature true if quiet available', () => {
        jest.spyOn(helper, 'getCurrentOperationMode').mockReturnValue(DaikinOperationModes.HEATING);
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue({ values: [DaikinFanSpeedModes.QUIET, 'auto'] });
        expect(helper.hasIndoorSilentModeFeature()).toBe(true);
    });

    test('hasOperationMode checks values', () => {
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue({ values: [DaikinOperationModes.DRY] });
        expect(helper.hasOperationMode(DaikinOperationModes.DRY)).toBe(true);
        expect(helper.hasOperationMode(DaikinOperationModes.COOLING)).toBe(false);
    });

    test('feature wrappers call logic', () => {
        jest.spyOn(helper, 'hasOperationMode').mockReturnValue(true);
        expect(helper.hasDryOperationModeFeature()).toBe(true);
        expect(helper.hasFanOnlyOperationModeFeature()).toBe(true);

        jest.spyOn(helper, 'hasSwingModeVerticalFeature').mockReturnValue(true);
        expect(helper.hasSwingModeFeature()).toBe(true);
    });

    test('hasSwingModeHorizontalFeature true', () => {
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue({ value: 'horizontal' });
        jest.spyOn(helper, 'getCurrentOperationMode').mockReturnValue(DaikinOperationModes.HEATING);
        expect(helper.hasSwingModeHorizontalFeature()).toBe(true);
    });

    test('hasSwingModeFeature checks both', () => {
        jest.spyOn(helper, 'hasSwingModeVerticalFeature').mockReturnValue(false);
        jest.spyOn(helper, 'hasSwingModeHorizontalFeature').mockReturnValue(true);
        expect(helper.hasSwingModeFeature()).toBe(true);

        jest.spyOn(helper, 'hasSwingModeHorizontalFeature').mockReturnValue(false);
        expect(helper.hasSwingModeFeature()).toBe(false);
    });

    test('hasPowerfulModeFeature', () => {
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue({ value: 1 });
        expect(helper.hasPowerfulModeFeature()).toBe(true);
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue(undefined);
        expect(helper.hasPowerfulModeFeature()).toBe(false);
    });

    test('hasEconoModeFeature', () => {
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue({ value: 1 });
        expect(helper.hasEconoModeFeature()).toBe(true);
    });

    test('hasStreamerModeFeature', () => {
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue({ value: 1 });
        expect(helper.hasStreamerModeFeature()).toBe(true);
    });

    test('hasOutdoorSilentModeFeature', () => {
        (DaikinCloudRepo.getData as jest.Mock).mockReturnValue({ value: 1 });
        expect(helper.hasOutdoorSilentModeFeature()).toBe(true);
    });
});
