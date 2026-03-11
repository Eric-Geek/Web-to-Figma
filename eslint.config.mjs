import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.mjs',
    ],
  },
  {
    rules: {
      // Allow unused vars prefixed with _ (convention for intentionally unused)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Prefer const over let where possible
      'prefer-const': 'error',
      // No console.log in source (use proper error handling)
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      // TypeScript-specific: allow explicit any in test files only
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
