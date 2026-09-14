import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import typescriptEslint from 'typescript-eslint';

const backendOnlyImports = [
  'node:fs',
  'node:fs/promises',
  'node:child_process',
  'fastify',
  'react',
  'react-dom',
];

const noApplicationOrProviderImports = [
  '@ai-sdlc/application',
  '@ai-sdlc/adapters-*',
  'fastify',
  'react',
  'react-dom',
  'node:*',
];

export default typescriptEslint.config(
  {
    ignores: [
      '**/.data/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'pnpm-lock.yaml',
    ],
  },
  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'separate-type-imports',
        },
      ],
    },
  },
  {
    files: ['packages/domain/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@ai-sdlc/application',
                '@ai-sdlc/workflow',
                '@ai-sdlc/config',
                '@ai-sdlc/observability',
                ...backendOnlyImports,
                'node:*',
              ],
              message: 'The domain package must remain framework and infrastructure independent.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/workflow/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@ai-sdlc/application',
                '@ai-sdlc/config',
                '@ai-sdlc/observability',
                ...backendOnlyImports,
                'node:*',
              ],
              message:
                'The workflow package may import domain only; keep it framework independent.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/contracts/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@ai-sdlc/*', ...backendOnlyImports, 'node:*'],
              message: 'Contracts must stay independent of backend implementations.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/application/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@ai-sdlc/adapters-*',
                'fastify',
                'react',
                'react-dom',
                'node:fs',
                'node:fs/promises',
              ],
              message: 'Application code must depend on ports, not transport or concrete adapters.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@ai-sdlc/domain',
                '@ai-sdlc/application',
                '@ai-sdlc/workflow',
                '@ai-sdlc/config',
                '@ai-sdlc/observability',
              ],
              message: 'The web app may consume shared contracts, never backend implementations.',
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
