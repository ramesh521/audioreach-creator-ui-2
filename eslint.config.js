/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import nodePlugin from 'eslint-plugin-n';
import securityPlugin from 'eslint-plugin-security';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import unicornPlugin from 'eslint-plugin-unicorn';
import promisePlugin from 'eslint-plugin-promise';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.tsbuildinfo',
      '**/coverage/**',
      '**/.yarn/**',
      '**/build/**',
      '**/out/**',
      '**/out-tsc/**',
      '**/temp/**',
      '**/.turbo/**',
      '**/.react-router/**',
      'eslint.config.js',
      // Config files that cause parsing errors
      '**/jest.config.mjs',
      '**/jest.config.js',
      '**/jest.config.ts',
      '**/jest.*.js',
      '**/jest.*.mjs',
      '**/postcss.config.js',
      '**/tailwind.config.js',
      // Scripts
      'scripts/**',
    ],
  },
  // Base configurations
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Configuration files - disable type-checked rules EARLY (before main config)
  {
    files: ['**/*.config.{js,ts,mjs}', '**/*.conf.{js,ts}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Plugin recommended configurations
  importPlugin.flatConfigs.recommended,
  nodePlugin.configs['flat/recommended'],
  securityPlugin.configs.recommended,
  sonarjsPlugin.configs.recommended,
  unicornPlugin.configs['recommended'],
  promisePlugin.configs['flat/recommended'],

  // Main configuration for all packages
  {
    files: ['**/*.{js,ts,mjs,cjs,tsx,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [
            './tsconfig.json',
            './packages/*/tsconfig.json',
            './packages/*/tsconfig.lib.json',
            './packages/*/tsconfig.node.json',
          ],
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        },
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
    rules: {
      // Configure unused vars to ignore parameters/variables prefixed with underscore
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  // React-specific configuration (react-app package only)
  {
    files: ['packages/react-app/**/*.{ts,tsx,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React recommended rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // JSX Accessibility rules
      ...jsxA11yPlugin.configs.recommended.rules,

      // React-specific overrides
      'react/prop-types': 'off', // TypeScript provides type checking
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'import/no-default-export': 'off', // React components often use default exports
    },
  },

  // Configuration files
  {
    files: ['**/*.config.{js,ts,mjs}', '**/*.conf.{js,ts}'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      'import/no-default-export': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'unicorn/prefer-module': 'off',
      'n/no-unpublished-import': 'off',
      'unicorn/import-style': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/prefer-node-protocol': 'off',
    },
  },

  // Main entry files
  {
    files: ['**/main.ts', '**/main.tsx', '**/index.ts'],
    rules: {
      'unicorn/no-process-exit': 'off',
      'n/no-process-exit': 'off',
    },
  },

  // Test files configuration
  {
    files: [
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/test/**/*.ts',
      '**/test/**/*.tsx',
      '**/tests/**/*.ts',
      '**/tests/**/*.tsx',
      '**/test-setup.ts',
    ],
    rules: {
      // TypeScript strict rules - relaxed for testing
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',

      // SonarJS rules - relaxed for testing
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-useless-catch': 'off',
      'sonarjs/no-nested-functions': 'off',
      'sonarjs/no-unused-vars': 'off',

      // Unicorn rules - relaxed for testing
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/numeric-separators-style': 'off',
      'unicorn/prefer-number-properties': 'off',
      'unicorn/prefer-global-this': 'off',
      'unicorn/no-useless-fallback-in-spread': 'off',

      // JSX Accessibility rules - relaxed for testing
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/role-has-required-aria-props': 'off',
      'jsx-a11y/interactive-supports-focus': 'off',
      'jsx-a11y/no-redundant-roles': 'off',

      // Security and other rules
      'security/detect-object-injection': 'off',
      'no-console': 'off',
      'no-useless-catch': 'off',
    },
  },

  // TypeScript-specific rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Disabled: Node plugin doesn't understand TypeScript imports. Using import/no-unresolved instead.
      'n/no-missing-import': 'off',
      // Disabled: Too many false positives for safe array access patterns used by major style guides
      'security/detect-object-injection': 'off',
      // Disabled: Allow TODO comments in development/placeholder code
      'sonarjs/todo-tag': 'off',
      // Disabled: Allow abbreviations in variable names for better readability
      'unicorn/prevent-abbreviations': 'off',
      // Disabled: Switch case braces are not required for our codebase style
      'unicorn/switch-case-braces': 'off',
      // Disabled: Prefer explicit if-else over ternary for better readability
      'unicorn/prefer-ternary': 'off',
      // Disabled: TypeError should only be used for JavaScript type errors, not data validation errors
      'unicorn/prefer-type-error': 'off',
      // Disabled: Allow null where it has semantic meaning (e.g., database NULL, explicit absence)
      'unicorn/no-null': 'off',
    },
  },

  // Prettier integration - must be last
  prettierConfig,
];
