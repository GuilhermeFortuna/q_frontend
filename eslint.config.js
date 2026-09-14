import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'src-tauri/target', 'coverage', 'contracts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Mocks are MSW fixtures for tests only. They must never be imported by
      // production code (and never seeded into component initial state) — that
      // ships fake data to users. See work-order-convention "cutover guardrail".
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/mocks', '@/mocks/*', '**/mocks/*'],
              message:
                'Do not import from @/mocks outside tests — mocks are MSW fixtures only. Use real query hooks; initialize state to null/[]/empty.',
            },
          ],
        },
      ],
    },
  },
  {
    // Sanctioned non-production consumers of the mock layer: tests, the mock
    // layer itself, and the MSW bootstrap (gated behind env.enableMsw, never
    // bundled in prod). Keep this list tight.
    files: [
      '**/*.test.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
      'src/mocks/**/*.{ts,tsx}',
      'tests/**/*.{ts,tsx}',
      'src/main.tsx',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
)
