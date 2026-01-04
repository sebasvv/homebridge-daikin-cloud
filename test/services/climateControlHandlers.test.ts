import { ClimateControlHandlers } from '../../src/services/climateControlHandlers';
import { ClimateControlHelper } from '../../src/services/climateControlHelper';
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

const mockLogger = {
    debug: jest.fn(),
    error: jest.fn(),
} as unknown as DaikinLogger;

const mockPlatform = {
    daikinLogger: mockLogger,
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

const mockHelper = {
    safeGetValue: jest.fn(),
    getCurrentControlMode: jest.fn(),
    getSetpoint: jest.fn(),
    getCurrentOperationMode: jest.fn(),
    hasSwingModeHorizontalFeature: jest.fn(),
    hasSwingModeVerticalFeature: jest.fn(),
} as unknown as ClimateControlHelper;

const mockForceUpdate = jest.fn();
const mockUpdateRotation = jest.fn();

describe('ClimateControlHandlers', () => {
    let handlers: ClimateControlHandlers;

    beforeEach(() => {
        jest.clearAllMocks();
        handlers = new ClimateControlHandlers(
            mockPlatform,
            mockDevice,
            'mp-id',
            'Test Handler',
            mockHelper,
            mockForceUpdate,
            mockUpdateRotation
        );
    });

    test('handleActiveStateGet returns true when ON', async () => {
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(DaikinOnOffModes.ON);
        expect(await handlers.handleActiveStateGet()).toBe(true);
    });

    test('handleActiveStateGet returns false when OFF', async () => {
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(DaikinOnOffModes.OFF);
        expect(await handlers.handleActiveStateGet()).toBe(false);
    });

    test('handleActiveStateSet turns ON', async () => {
        await handlers.handleActiveStateSet(true);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'onOffMode', undefined, DaikinOnOffModes.ON);
        expect(mockForceUpdate).toHaveBeenCalled();
    });

    test('handleActiveStateSet turns OFF', async () => {
        await handlers.handleActiveStateSet(false);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'onOffMode', undefined, DaikinOnOffModes.OFF);
    });

    test('handleCurrentTemperatureGet', async () => {
        (mockHelper.getCurrentControlMode as jest.Mock).mockReturnValue('control-mode');
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(22.5);
        expect(await handlers.handleCurrentTemperatureGet()).toBe(22.5);
        expect(mockHelper.safeGetValue).toHaveBeenCalledWith('sensoryData', '/control-mode', 0);
    });

    test('handleCoolingThresholdTemperatureGet', async () => {
        (mockHelper.getSetpoint as jest.Mock).mockReturnValue('setpoint');
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(24);
        expect(await handlers.handleCoolingThresholdTemperatureGet()).toBe(24);
        expect(mockHelper.safeGetValue).toHaveBeenCalledWith(
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.COOLING}/setpoints/setpoint`,
            0
        );
    });

    test('handleCoolingThresholdTemperatureSet', async () => {
        (mockHelper.getSetpoint as jest.Mock).mockReturnValue('setpoint');
        await handlers.handleCoolingThresholdTemperatureSet(23.4); // Rounds to 23.5
        expect(mockDevice.setData).toHaveBeenCalledWith(
            'mp-id',
            'temperatureControl',
            `/operationModes/${DaikinOperationModes.COOLING}/setpoints/setpoint`,
            23.5
        );
    });

    test('handleRotationSpeedGet', async () => {
        (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(3);
        expect(await handlers.handleRotationSpeedGet()).toBe(3);
    });

    test('handleRotationSpeedSet', async () => {
        (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');
        await handlers.handleRotationSpeedSet(5);
        expect(mockDevice.setData).toHaveBeenCalledWith(
            'mp-id', 'fanControl', '/operationModes/mode/fanSpeed/currentMode', 'fixed'
        );
        expect(mockDevice.setData).toHaveBeenCalledWith(
            'mp-id', 'fanControl', '/operationModes/mode/fanSpeed/modes/fixed', 5
        );
    });

    test('handleHeatingThresholdTemperatureGet', async () => {
        (mockHelper.getSetpoint as jest.Mock).mockReturnValue('setpoint');
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(21);
        expect(await handlers.handleHeatingThresholdTemperatureGet()).toBe(21);
    });

    test('handleHeatingThresholdTemperatureSet', async () => {
        (mockHelper.getSetpoint as jest.Mock).mockReturnValue('setpoint');
        await handlers.handleHeatingThresholdTemperatureSet(21.1); // Rounds to 21
        expect(mockDevice.setData).toHaveBeenCalledWith(
            'mp-id', 'temperatureControl', `/operationModes/${DaikinOperationModes.HEATING}/setpoints/setpoint`, 21
        );
    });

    describe('TargetHeaterCoolerState', () => {
        test('GET returns COOL', async () => {
            (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue(DaikinOperationModes.COOLING);
            expect(await handlers.handleTargetHeaterCoolerStateGet()).toBe(mockPlatform.Characteristic.TargetHeaterCoolerState.COOL);
        });

        test('GET returns HEAT', async () => {
            (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue(DaikinOperationModes.HEATING);
            expect(await handlers.handleTargetHeaterCoolerStateGet()).toBe(mockPlatform.Characteristic.TargetHeaterCoolerState.HEAT);
        });

        test('GET returns AUTO for DRY (and updates rotation)', async () => {
            (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue(DaikinOperationModes.DRY);
            expect(await handlers.handleTargetHeaterCoolerStateGet()).toBe(mockPlatform.Characteristic.TargetHeaterCoolerState.AUTO);
            expect(mockUpdateRotation).toHaveBeenCalled();
        });

        test('GET returns AUTO for unknown (default)', async () => {
            (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue('UNKNOWN_MODE');
            expect(await handlers.handleTargetHeaterCoolerStateGet()).toBe(mockPlatform.Characteristic.TargetHeaterCoolerState.AUTO);
        });

        test('SET COOL', async () => {
            await handlers.handleTargetHeaterCoolerStateSet(mockPlatform.Characteristic.TargetHeaterCoolerState.COOL);
            expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', undefined, DaikinOperationModes.COOLING);
        });

        test('SET HEAT', async () => {
            await handlers.handleTargetHeaterCoolerStateSet(mockPlatform.Characteristic.TargetHeaterCoolerState.HEAT);
            expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', undefined, DaikinOperationModes.HEATING);
        });

        test('SET AUTO', async () => {
            await handlers.handleTargetHeaterCoolerStateSet(mockPlatform.Characteristic.TargetHeaterCoolerState.AUTO);
            expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', undefined, DaikinOperationModes.AUTO);
        });
    });

    describe('SwingMode', () => {
        test('SET Swing ENABLED (Vertical + Horizontal)', async () => {
            (mockHelper.hasSwingModeHorizontalFeature as jest.Mock).mockReturnValue(true);
            (mockHelper.hasSwingModeVerticalFeature as jest.Mock).mockReturnValue(true);
            (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');

            await handlers.handleSwingModeSet(1); // Enabled

            expect(mockDevice.setData).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining('horizontal'), DaikinFanDirectionHorizontalModes.SWING);
            expect(mockDevice.setData).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining('vertical'), DaikinFanDirectionVerticalModes.SWING);
        });

        test('SET Swing ENABLED (Only Vertical)', async () => {
            (mockHelper.hasSwingModeHorizontalFeature as jest.Mock).mockReturnValue(false);
            (mockHelper.hasSwingModeVerticalFeature as jest.Mock).mockReturnValue(true);
            (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');

            await handlers.handleSwingModeSet(1);

            expect(mockDevice.setData).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining('vertical'), DaikinFanDirectionVerticalModes.SWING);
            expect(mockDevice.setData).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining('horizontal'), expect.anything());
        });

        test('SET Swing ENABLED (Only Horizontal)', async () => {
            (mockHelper.hasSwingModeHorizontalFeature as jest.Mock).mockReturnValue(true);
            (mockHelper.hasSwingModeVerticalFeature as jest.Mock).mockReturnValue(false);
            (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');

            await handlers.handleSwingModeSet(1);

            expect(mockDevice.setData).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining('horizontal'), DaikinFanDirectionHorizontalModes.SWING);
            expect(mockDevice.setData).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining('vertical'), expect.anything());
        });

        test('GET Swing DISABLED', async () => {
            (mockHelper.hasSwingModeVerticalFeature as jest.Mock).mockReturnValue(true);
            (mockHelper.hasSwingModeHorizontalFeature as jest.Mock).mockReturnValue(true);
            (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');

            (mockHelper.safeGetValue as jest.Mock).mockImplementation((_k, path) => {
                if (path.includes('vertical')) return DaikinFanDirectionVerticalModes.STOP;
                return DaikinFanDirectionHorizontalModes.SWING;
            });

            expect(await handlers.handleSwingModeGet()).toBe(mockPlatform.Characteristic.SwingMode.SWING_DISABLED);
        });

        test('GET Swing ENABLED', async () => {
            (mockHelper.hasSwingModeVerticalFeature as jest.Mock).mockReturnValue(true);
            (mockHelper.hasSwingModeHorizontalFeature as jest.Mock).mockReturnValue(true);
            (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');

            (mockHelper.safeGetValue as jest.Mock).mockImplementation((_k, path) => {
                if (path.includes('vertical')) return DaikinFanDirectionVerticalModes.SWING;
                return DaikinFanDirectionHorizontalModes.SWING;
            });

            expect(await handlers.handleSwingModeGet()).toBe(mockPlatform.Characteristic.SwingMode.SWING_ENABLED);
        });

        test('GET Swing DISABLED (Vertical STOP, Horizontal Feature Missing)', async () => {
            (mockHelper.hasSwingModeVerticalFeature as jest.Mock).mockReturnValue(true);
            (mockHelper.hasSwingModeHorizontalFeature as jest.Mock).mockReturnValue(false);
            (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');

            (mockHelper.safeGetValue as jest.Mock).mockReturnValue(DaikinFanDirectionVerticalModes.STOP);

            expect(await handlers.handleSwingModeGet()).toBe(mockPlatform.Characteristic.SwingMode.SWING_DISABLED);
        });

        test('GET Swing ENABLED (Only Horizontal SWING)', async () => {
            (mockHelper.hasSwingModeVerticalFeature as jest.Mock).mockReturnValue(false);
            (mockHelper.hasSwingModeHorizontalFeature as jest.Mock).mockReturnValue(true);
            (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');

            (mockHelper.safeGetValue as jest.Mock).mockReturnValue(DaikinFanDirectionHorizontalModes.SWING);

            expect(await handlers.handleSwingModeGet()).toBe(mockPlatform.Characteristic.SwingMode.SWING_ENABLED);
        });
    });

    test('handlePowerfulModeGet/Set', async () => {
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(DaikinPowerfulModes.ON);
        expect(await handlers.handlePowerfulModeGet()).toBe(true);

        await handlers.handlePowerfulModeSet(false);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'powerfulMode', undefined, DaikinPowerfulModes.OFF);

        await handlers.handlePowerfulModeSet(true);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'powerfulMode', undefined, DaikinPowerfulModes.ON);
    });

    test('handleEconoModeGet/Set', async () => {
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(DaikinEconoModes.ON);
        expect(await handlers.handleEconoModeGet()).toBe(true);

        await handlers.handleEconoModeSet(false);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'econoMode', undefined, DaikinEconoModes.OFF);

        await handlers.handleEconoModeSet(true);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'econoMode', undefined, DaikinEconoModes.ON);
    });

    test('handleStreamerModeGet/Set', async () => {
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(DaikinStreamerModes.ON);
        expect(await handlers.handleStreamerModeGet()).toBe(true);

        await handlers.handleStreamerModeSet(false);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'streamerMode', undefined, DaikinStreamerModes.OFF);

        await handlers.handleStreamerModeSet(true);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'streamerMode', undefined, DaikinStreamerModes.ON);
    });

    test('handleOutdoorSilentModeGet/Set', async () => {
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(DaikinOutdoorSilentModes.ON);
        expect(await handlers.handleOutdoorSilentModeGet()).toBe(true);

        await handlers.handleOutdoorSilentModeSet(false);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'outdoorSilentMode', undefined, DaikinOutdoorSilentModes.OFF);

        await handlers.handleOutdoorSilentModeSet(true);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'outdoorSilentMode', undefined, DaikinOutdoorSilentModes.ON);
    });

    test('handleIndoorSilentModeGet/Set', async () => {
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(DaikinFanSpeedModes.QUIET);
        (mockHelper.getCurrentOperationMode as jest.Mock).mockReturnValue('mode');
        expect(await handlers.handleIndoorSilentModeGet()).toBe(true);

        await handlers.handleIndoorSilentModeSet(true); // Quiet
        expect(mockDevice.setData).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), DaikinFanSpeedModes.QUIET);

        await handlers.handleIndoorSilentModeSet(false); // Fixed
        expect(mockDevice.setData).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), DaikinFanSpeedModes.FIXED);
    });

    test('handleDryOperationModeGet/Set', async () => {
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(DaikinOperationModes.DRY);
        expect(await handlers.handleDryOperationModeGet()).toBe(true);

        await handlers.handleDryOperationModeSet(true);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', undefined, DaikinOperationModes.DRY);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'onOffMode', undefined, DaikinOnOffModes.ON);

        await handlers.handleDryOperationModeSet(false);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', undefined, DaikinOperationModes.AUTO);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'onOffMode', undefined, DaikinOnOffModes.OFF);
    });

    test('handleFanOnlyOperationModeGet/Set', async () => {
        (mockHelper.safeGetValue as jest.Mock).mockReturnValue(DaikinOperationModes.FAN_ONLY);
        expect(await handlers.handleFanOnlyOperationModeGet()).toBe(true);

        await handlers.handleFanOnlyOperationModeSet(true);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', undefined, DaikinOperationModes.FAN_ONLY);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'onOffMode', undefined, DaikinOnOffModes.ON);

        await handlers.handleFanOnlyOperationModeSet(false);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'operationMode', undefined, DaikinOperationModes.AUTO);
        expect(mockDevice.setData).toHaveBeenCalledWith('mp-id', 'onOffMode', undefined, DaikinOnOffModes.OFF);
    });

    test('safeSetData logs error on failure', async () => {
        (mockDevice.setData as jest.Mock).mockRejectedValue(new Error('Set failed'));
        await handlers.handleActiveStateSet(true);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error setting data'));
    });
});
