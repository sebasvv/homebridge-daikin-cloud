import { APIService } from '../../src/services/APIService';
import { ConfigService } from '../../src/services/ConfigService';
import { DaikinLogger } from '../../src/services/logger';
import { DaikinCloudController } from 'daikin-controller-cloud';
import { stat } from 'node:fs/promises';

// Mock dependnecies
jest.mock('daikin-controller-cloud');
jest.mock('node:fs/promises');
jest.mock('../../src/services/ConfigService');
jest.mock('../../src/services/logger');

describe('APIService', () => {
    let apiService: APIService;
    let mockConfigService: jest.Mocked<ConfigService>;
    let mockLogger: jest.Mocked<DaikinLogger>;
    let mockController: jest.Mocked<DaikinCloudController>;

    beforeEach(() => {
        jest.useFakeTimers();

        mockConfigService = new ConfigService({} as any, {} as any) as jest.Mocked<ConfigService>;
        Object.defineProperty(mockConfigService, 'props', {
            value: {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                oidcCallbackServerBindAddr: '0.0.0.0',
                callbackServerExternalAddress: 'localhost',
                callbackServerPort: 3000,
            },
            writable: true
        });

        mockLogger = new DaikinLogger({} as any) as jest.Mocked<DaikinLogger>;

        // Setup mock controller instance
        (DaikinCloudController as unknown as jest.Mock).mockClear();
        mockController = {
            on: jest.fn(),
            updateAllDeviceData: jest.fn().mockResolvedValue(undefined),
            getCloudDevices: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<DaikinCloudController>;

        (DaikinCloudController as unknown as jest.Mock).mockImplementation(() => mockController);

        // Mock fs.stat to simulate token file existing
        (stat as jest.Mock).mockResolvedValue({ mtime: new Date(), birthtime: new Date() });

        apiService = new APIService(mockConfigService, mockLogger, '/tmp/storage');
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('updateAllDeviceData', () => {
        it('should call controller.updateAllDeviceData when no user interaction occurred', async () => {
            await apiService.updateAllDeviceData();
            expect(mockController.updateAllDeviceData).toHaveBeenCalledTimes(1);
        });

        it('should skip update if user interaction happened recently (optimistic UI)', async () => {
            apiService.notifyUserInteraction();

            // Interaction just happened, should skip
            await apiService.updateAllDeviceData();

            expect(mockController.updateAllDeviceData).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Skipping cloud update due to recent user interaction')
            );
        });

        it('should force update even if debouncing', async () => {
            apiService.notifyUserInteraction();

            // Force update is true
            await apiService.updateAllDeviceData(true);

            expect(mockController.updateAllDeviceData).toHaveBeenCalledTimes(1);
        });

        it('should allow update after debounce window expires', async () => {
            apiService.notifyUserInteraction();

            // Attempt update immediately (should be skipped)
            await apiService.updateAllDeviceData();
            expect(mockController.updateAllDeviceData).not.toHaveBeenCalled();

            // Advance time past the 15s window
            jest.advanceTimersByTime(15001);

            // Attempt update again
            await apiService.updateAllDeviceData();
            expect(mockController.updateAllDeviceData).toHaveBeenCalledTimes(1);
        });
    });

    describe('User Interaction Notification', () => {
        it('should update the last interaction timestamp', () => {
            // Accessing private property for testing if needed, or inferring from behavior
            const spyDate = jest.spyOn(Date, 'now');
            apiService.notifyUserInteraction();
            expect(spyDate).toHaveBeenCalled();
        });
    });
});
