import { StringUtils } from '../../src/utils/strings';

describe('StringUtils', () => {
    describe('mask', () => {
        test('should mask string longer than 6 chars', () => {
            expect(StringUtils.mask('1234567')).toBe('123******567');
        });

        test('should return replacement for string <= 6 chars', () => {
            expect(StringUtils.mask('123456')).toBe('******');
            expect(StringUtils.mask('')).toBe('******');
        });

        test('should return replacement for non-string', () => {
            expect(StringUtils.mask(null)).toBe('******');
            expect(StringUtils.mask(123)).toBe('******');
        });
    });

    describe('isEmpty', () => {
        test('should return true for empty or non-string', () => {
            expect(StringUtils.isEmpty('')).toBe(true);
            expect(StringUtils.isEmpty(null)).toBe(true);
            expect(StringUtils.isEmpty(undefined)).toBe(true);
        });

        test('should return false for non-empty string', () => {
            expect(StringUtils.isEmpty('test')).toBe(false);
        });
    });
});
