import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';
export default defineConfig([
  ...nextVitals, ...nextTs,
  globalIgnores(['.next/**', 'node_modules/**', '.vs/**', 'notes/**', 'next-env.d.ts']),
  { files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    plugins: { typed: tseslint.plugin },
    rules: {
      'typed/no-unsafe-type-assertion': 'error', '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error', curly: ['error', 'all'],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'no-restricted-globals': ['error', 'localStorage'],
      'no-restricted-syntax': ['error', { selector: 'TSUnknownKeyword', message: 'Use a precise type.' },
        { selector: 'MemberExpression[property.name="localStorage"]', message: 'Use server persistence.' },
        { selector: 'JSXAttribute[name.name="style"]', message: 'Use theme or sx.' }],
    },
  },
]);
