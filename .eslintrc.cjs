module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  overrides: [
    {
      files: ['*.test.ts', '*.spec.ts'],
      env: {
        jest: true,
      },
    },
    {
      files: ['src/**/*.tsx', 'src/**/*.ts'],
      excludeFiles: ['src/workers/*.ts', 'src/lib/**/*.test.ts'],
      extends: [
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
      ],
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      },
    },
    {
      files: ['src/workers/*.ts'],
      env: {
        worker: true,
        browser: true,
      },
      rules: {
        'no-console': 'off', // Workers may need console logging
      },
    },
    {
      files: ['src/lib/torrent-protocol/**/*.ts', 'src/lib/mesh-dl-protocol/**/*.ts', 'src/lib/content-cache/**/*.ts', 'src/lib/chunk-transfer/**/*.ts', 'src/lib/spectrum-monitor/**/*.ts', 'src/lib/webrtc-swarm/**/*.ts', 'src/lib/band-manager/**/*.ts'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        'prefer-readonly': 'error',
      },
    },
  ],
};