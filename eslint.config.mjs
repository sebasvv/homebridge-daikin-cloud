import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: ['dist/**'],
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: true,
            },
        },
        rules: {
            'quotes': ['warn', 'single'],
            'indent': ['warn', 4, { 'SwitchCase': 1 }],
            'semi': ['off'],
            'comma-dangle': ['warn', 'always-multiline'],
            'dot-notation': 'off',
            'eqeqeq': 'warn',
            'curly': ['warn', 'all'],
            'brace-style': ['warn'],
            'prefer-arrow-callback': ['warn'],
            'no-console': ['warn'],
            'no-non-null-assertion': ['off'],
            'comma-spacing': ['error'],
            'no-multi-spaces': ['warn', { 'ignoreEOLComments': true }],
            'no-trailing-spaces': ['warn'],
            'lines-between-class-members': ['warn', 'always', { 'exceptAfterSingleLine': true }],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
        }
    }
);
