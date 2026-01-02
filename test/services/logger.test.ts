import { DaikinLogger } from '../../src/services/logger';
import { Logger as HomebridgeLogger } from 'homebridge';

describe('DaikinLogger', () => {
    let mockHomebridgeLogger: jest.Mocked<HomebridgeLogger>;

    beforeEach(() => {
        mockHomebridgeLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as any;
    });

    test('should log info with prefix', () => {
        const logger = new DaikinLogger(mockHomebridgeLogger, 'Prefix');
        logger.info('test message');
        expect(mockHomebridgeLogger.info).toHaveBeenCalledWith('[Prefix] test message');
    });

    test('should log info without prefix', () => {
        const logger = new DaikinLogger(mockHomebridgeLogger);
        logger.info('test message');
        expect(mockHomebridgeLogger.info).toHaveBeenCalledWith('test message');
    });

    test('should log with parameters', () => {
        const logger = new DaikinLogger(mockHomebridgeLogger);
        logger.warn('test message', { foo: 'bar' });
        expect(mockHomebridgeLogger.warn).toHaveBeenCalledWith('test message [{"foo":"bar"}]');
    });

    test('should log errors', () => {
        const logger = new DaikinLogger(mockHomebridgeLogger);
        logger.error('error message');
        expect(mockHomebridgeLogger.error).toHaveBeenCalledWith('error message');
    });

    describe('debug', () => {
        test('should log to info when debugMode is true', () => {
            const logger = new DaikinLogger(mockHomebridgeLogger, undefined, true);
            logger.debug('debug message');
            expect(mockHomebridgeLogger.info).toHaveBeenCalledWith('debug message');
            expect(mockHomebridgeLogger.debug).not.toHaveBeenCalled();
        });

        test('should log to debug when debugMode is false', () => {
            const logger = new DaikinLogger(mockHomebridgeLogger, undefined, false);
            logger.debug('debug message');
            expect(mockHomebridgeLogger.debug).toHaveBeenCalledWith('debug message');
            expect(mockHomebridgeLogger.info).not.toHaveBeenCalled();
        });
    });
});
