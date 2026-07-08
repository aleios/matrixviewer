import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import globals from 'globals'

export default defineConfigWithVueTs(
    // 1. Global ignores (replaces .eslintignore)
    {
        ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
    },

    // 2. Global language options
    {
        languageOptions: {
            globals: globals.browser,
        },
    },

    // 3. Vue plugin base configuration
    ...pluginVue.configs['flat/recommended'],

    // 4. TypeScript + Vue rule preset
    vueTsConfigs.recommended,

    // 5. Custom project overrides
    {
        files: ['**/*.vue', '**/*.ts'],
        rules: {
            'vue/multi-word-component-names': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
        },
    }
)
