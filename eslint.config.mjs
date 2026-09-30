import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';

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

  // Base configs from Next.js (next/typescript already includes typescript-eslint recommended)
  ...nextCoreWebVitals,
  ...nextTypescript,

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

      // React Compiler rules (react-hooks v7). next.config.ts has reactCompiler: false, so these are advisory.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
];

export default eslintConfig;
