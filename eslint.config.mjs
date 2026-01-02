import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    // Disable ESLint rules that conflict with Prettier
    eslintConfigPrettier,
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
            'eqeqeq': 'warn',
            'curly': ['warn', 'all'],
            'brace-style': ['warn'],
            'prefer-arrow-callback': ['warn'],
            'no-console': ['warn'],
            'no-non-null-assertion': ['off'],
            'lines-between-class-members': ['warn', 'always', { 'exceptAfterSingleLine': true }],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
        }
    }
);
