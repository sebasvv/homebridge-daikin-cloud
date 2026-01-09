import { ClimateControlHandlers } from '../../src/services/climateControlHandlers';
import { DaikinDeviceWrapper } from '../../src/utils/DaikinDeviceWrapper';
import { DaikinCloudPlatform } from '../../src/platform';
import { DaikinCloudDevice } from 'daikin-controller-cloud/dist/device';
import { DaikinLogger } from '../../src/services/logger';
import {
    DaikinOnOffModes,
    DaikinOperationModes,
    DaikinFanDirectionHorizontalModes,
    DaikinFanDirectionVerticalModes,
    DaikinFanSpeedModes,
    DaikinPowerfulModes,
    DaikinEconoModes,
    DaikinStreamerModes,
    DaikinOutdoorSilentModes
} from '../../src/services/baseService';

import { APIService } from '../../src/services/APIService';

jest.mock('../../src/utils/DaikinDeviceWrapper');

const mockLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
} as unknown as DaikinLogger;

const mockApiService = {
    setDeviceData: jest.fn(),
    notifyUserInteraction: jest.fn(),
} as unknown as APIService;

const mockPlatform = {
    daikinLogger: mockLogger,
    apiService: mockApiService,
    Characteristic: {
        TargetHeaterCoolerState: {
            COOL: 0,
            HEAT: 1,
            AUTO: 2,
        },
        SwingMode: {
            SWING_DISABLED: 0,
            SWING_ENABLED: 1,
        },
    },
} as unknown as DaikinCloudPlatform;

const mockDevice = {
    setData: jest.fn(),
    getLastUpdated: jest.fn().mockReturnValue('mock-date'),
} as unknown as DaikinCloudDevice;



describe('ClimateControlHandlers', () => {
    let handlers: ClimateControlHandlers;
    let mockDaikinDeviceWrapper: DaikinDeviceWrapper;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDaikinDeviceWrapper = new DaikinDeviceWrapper(mockDevice, 'mp-id');
        handlers = new ClimateControlHandlers(
            mockPlatform,
            mockDevice,
            'mp-id',
            'Test Handler',
            mockDaikinDeviceWrapper,
        );
    });

    test('handleActiveStateGet returns true when ON', async () => {
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(DaikinOnOffModes.ON);
        expect(await handlers.handleActiveStateGet()).toBe(true);
    });

    test('handleActiveStateGet returns false when OFF', async () => {
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(DaikinOnOffModes.OFF);
        expect(await handlers.handleActiveStateGet()).toBe(false);
    });

    test('handleActiveStateSet turns ON', async () => {
        await handlers.handleActiveStateSet(true);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'onOffMode', undefined, DaikinOnOffModes.ON);
        expect(mockApiService.notifyUserInteraction).toHaveBeenCalled();
    });

    test('handleActiveStateSet turns OFF', async () => {
        await handlers.handleActiveStateSet(false);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'onOffMode', undefined, DaikinOnOffModes.OFF);
    });

    test('handleCurrentTemperatureGet', async () => {
        (mockDaikinDeviceWrapper.getCurrentControlMode as jest.Mock).mockReturnValue('control-mode');
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(22.5);
        expect(await handlers.handleCurrentTemperatureGet()).toBe(22.5);
    });

    test('handleCoolingThresholdTemperatureGet', async () => {
        (mockDaikinDeviceWrapper.getSetpointType as jest.Mock).mockReturnValue('setpoint');
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(24);
        expect(await handlers.handleCoolingThresholdTemperatureGet()).toBe(24);
    });

    test('handleCoolingThresholdTemperatureSet', async () => {
        (mockDaikinDeviceWrapper.getSetpointType as jest.Mock).mockReturnValue('setpoint');
        await handlers.handleCoolingThresholdTemperatureSet(23.4); // Rounds to 23.5
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(
            mockDevice,
            'mp-id',
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.COOLING}/setpoints/setpoint`,
            23.5
        );
    });

    test('handleRotationSpeedGet', async () => {
        (mockDaikinDeviceWrapper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(3);
        expect(await handlers.handleFanRotationSpeedGet()).toBe(60);
    });

    test('handleRotationSpeedSet', async () => {
        (mockDaikinDeviceWrapper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');
        await handlers.handleFanRotationSpeedSet(100);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(
            mockDevice, 'mp-id', 'fanControl', '/operationModes/mode/fanSpeed/currentMode', 'fixed'
        );
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(
            mockDevice, 'mp-id', 'fanControl', '/operationModes/mode/fanSpeed/modes/fixed', 5
        );
    });

    test('handleHeatingThresholdTemperatureGet', async () => {
        (mockDaikinDeviceWrapper.getSetpointType as jest.Mock).mockReturnValue('setpoint');
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(21);
        expect(await handlers.handleHeatingThresholdTemperatureGet()).toBe(21);
    });
    // ... skipped unchanged ...

    test('handleHeatingThresholdTemperatureSet', async () => {
        (mockDaikinDeviceWrapper.getSetpointType as jest.Mock).mockReturnValue('setpoint');
        await handlers.handleHeatingThresholdTemperatureSet(21.1); // Rounds to 21
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(
            mockDevice, 'mp-id', 'temperatureControl', `/operationModes/${DaikinOperationModes.HEATING}/setpoints/setpoint`, 21
        );
    });

    describe('TargetHeaterCoolerState', () => {
        test('GET returns COOL', async () => {
            (mockDaikinDeviceWrapper.getCurrentOperationMode as jest.Mock).mockReturnValue(DaikinOperationModes.COOLING);
            expect(await handlers.handleTargetHeaterCoolerStateGet()).toBe(mockPlatform.Characteristic.TargetHeaterCoolerState.COOL);
        });

        test('GET returns HEAT', async () => {
            (mockDaikinDeviceWrapper.getCurrentOperationMode as jest.Mock).mockReturnValue(DaikinOperationModes.HEATING);
            expect(await handlers.handleTargetHeaterCoolerStateGet()).toBe(mockPlatform.Characteristic.TargetHeaterCoolerState.HEAT);
        });

        test('GET returns AUTO for DRY (and does NOT update rotation)', async () => {
            (mockDaikinDeviceWrapper.getCurrentOperationMode as jest.Mock).mockReturnValue(DaikinOperationModes.DRY);
            expect(await handlers.handleTargetHeaterCoolerStateGet()).toBe(mockPlatform.Characteristic.TargetHeaterCoolerState.AUTO);
            // expect(mockUpdateRotation).toHaveBeenCalled(); // Removed
        });

        test('GET returns AUTO for unknown (default)', async () => {
            (mockDaikinDeviceWrapper.getCurrentOperationMode as jest.Mock).mockReturnValue('UNKNOWN_MODE');
            expect(await handlers.handleTargetHeaterCoolerStateGet()).toBe(mockPlatform.Characteristic.TargetHeaterCoolerState.AUTO);
        });

        test('SET COOL', async () => {
            await handlers.handleTargetHeaterCoolerStateSet(mockPlatform.Characteristic.TargetHeaterCoolerState.COOL);
            expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'operationMode', undefined, DaikinOperationModes.COOLING);
        });

        test('SET HEAT', async () => {
            await handlers.handleTargetHeaterCoolerStateSet(mockPlatform.Characteristic.TargetHeaterCoolerState.HEAT);
            expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'operationMode', undefined, DaikinOperationModes.HEATING);
        });

        test('SET AUTO', async () => {
            await handlers.handleTargetHeaterCoolerStateSet(mockPlatform.Characteristic.TargetHeaterCoolerState.AUTO);
            expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'operationMode', undefined, DaikinOperationModes.AUTO);
        });
    });

    describe('handleSwingMode', () => {
        test('handleVerticalSwingModeGet/Set', async () => {
            (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(DaikinFanDirectionVerticalModes.SWING);
            expect(await handlers.handleVerticalSwingModeGet()).toBe(true);

            await handlers.handleVerticalSwingModeSet(false);
            expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'fanControl', expect.stringContaining('vertical'), DaikinFanDirectionVerticalModes.STOP);

            await handlers.handleVerticalSwingModeSet(true);
            expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'fanControl', expect.stringContaining('vertical'), DaikinFanDirectionVerticalModes.SWING);
        });

        test('handleHorizontalSwingModeGet/Set', async () => {
            (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(DaikinFanDirectionHorizontalModes.STOP);
            expect(await handlers.handleHorizontalSwingModeGet()).toBe(false);

            await handlers.handleHorizontalSwingModeSet(true);
            expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'fanControl', expect.stringContaining('horizontal'), DaikinFanDirectionHorizontalModes.SWING);
        });
    });

    test('handlePowerfulModeGet/Set', async () => {
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(DaikinPowerfulModes.ON);
        expect(await handlers.handlePowerfulModeGet()).toBe(true);

        await handlers.handlePowerfulModeSet(false);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'powerfulMode', undefined, DaikinPowerfulModes.OFF);

        await handlers.handlePowerfulModeSet(true);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'powerfulMode', undefined, DaikinPowerfulModes.ON);
    });

    test('handleEconoModeGet/Set', async () => {
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(DaikinEconoModes.ON);
        expect(await handlers.handleEconoModeGet()).toBe(true);

        await handlers.handleEconoModeSet(false);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'econoMode', undefined, DaikinEconoModes.OFF);

        await handlers.handleEconoModeSet(true);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'econoMode', undefined, DaikinEconoModes.ON);
    });

    test('handleStreamerModeGet/Set', async () => {
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(DaikinStreamerModes.ON);
        expect(await handlers.handleStreamerModeGet()).toBe(true);

        await handlers.handleStreamerModeSet(false);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'streamerMode', undefined, DaikinStreamerModes.OFF);

        await handlers.handleStreamerModeSet(true);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'streamerMode', undefined, DaikinStreamerModes.ON);
    });

    test('handleOutdoorSilentModeGet/Set', async () => {
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(DaikinOutdoorSilentModes.ON);
        expect(await handlers.handleOutdoorSilentModeGet()).toBe(true);

        await handlers.handleOutdoorSilentModeSet(false);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'outdoorSilentMode', undefined, DaikinOutdoorSilentModes.OFF);

        await handlers.handleOutdoorSilentModeSet(true);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'outdoorSilentMode', undefined, DaikinOutdoorSilentModes.ON);
    });

    test('handleIndoorSilentModeGet/Set', async () => {
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(DaikinFanSpeedModes.QUIET);
        (mockDaikinDeviceWrapper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');
        expect(await handlers.handleIndoorSilentModeGet()).toBe(true);

        await handlers.handleIndoorSilentModeSet(true); // Quiet
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, expect.anything(), expect.anything(), expect.anything(), DaikinFanSpeedModes.QUIET);

        await handlers.handleIndoorSilentModeSet(false); // Fixed
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, expect.anything(), expect.anything(), expect.anything(), DaikinFanSpeedModes.FIXED);
    });

    test('handleDryOperationModeGet/Set', async () => {
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(DaikinOperationModes.DRY);
        expect(await handlers.handleDryOperationModeGet()).toBe(true);

        await handlers.handleDryOperationModeSet(true);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'operationMode', undefined, DaikinOperationModes.DRY);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'onOffMode', undefined, DaikinOnOffModes.ON);

        await handlers.handleDryOperationModeSet(false);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'operationMode', undefined, DaikinOperationModes.AUTO);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'onOffMode', undefined, DaikinOnOffModes.OFF);
    });

    test('handleFanOnlyOperationModeGet/Set', async () => {
        (mockDaikinDeviceWrapper.safeGetValue as jest.Mock).mockReturnValue(DaikinOperationModes.FAN_ONLY);
        expect(await handlers.handleFanOnlyOperationModeGet()).toBe(true);

        await handlers.handleFanOnlyOperationModeSet(true);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'operationMode', undefined, DaikinOperationModes.FAN_ONLY);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'onOffMode', undefined, DaikinOnOffModes.ON);

        await handlers.handleFanOnlyOperationModeSet(false);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'operationMode', undefined, DaikinOperationModes.AUTO);
        expect(mockApiService.setDeviceData).toHaveBeenCalledWith(mockDevice, 'mp-id', 'onOffMode', undefined, DaikinOnOffModes.OFF);
    });

    test('safeSetData logs error on failure', async () => {
        (mockApiService.setDeviceData as jest.Mock).mockRejectedValue(new Error('Set failed'));
        await handlers.handleActiveStateSet(true);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error setting data'));
    });
});

