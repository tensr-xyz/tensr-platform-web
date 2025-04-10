import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import prettierConfig from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Get TypeScript ESLint configurations from the compat layer
const typescriptEslintConfigs = compat.extends('plugin:@typescript-eslint/recommended');

const eslintConfig = [
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: [
      // Build outputs
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',

      // Dependencies
      'node_modules/**',

      // Cache
      '.eslintcache',

      // Misc
      '**/.DS_Store',
      '**/*.pem',

      // Debug logs
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',

      // Local env files
      '.env*.local',

      // Typescript
      '**/*.tsbuildinfo',
      'next-env.d.ts',

      // Public assets
      'public/**',

      // Generated files
      'coverage/**',
    ],
  },

  // Base configs from Next.js
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // Add TypeScript ESLint configs
  ...typescriptEslintConfigs,

  // Add Prettier as a separate config (this must come after other style configs)
  prettierConfig,

  // Add custom rules
  {
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      // Prettier rules
      'prettier/prettier': 'error',

      // TypeScript rules
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        {
          'ts-ignore': 'allow-with-description',
          'ts-expect-error': 'allow-with-description',
          'ts-nocheck': 'allow-with-description',
        },
      ],
    },
  },
];

export default eslintConfig;
