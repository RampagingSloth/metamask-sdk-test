const path = require('path');

/**
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  extends: ['@metamask/eslint-config-typescript'],
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [path.resolve(__dirname, 'tsconfig.json')],
  },

  ignorePatterns: [
    '.prettierrc.js',
    'babel.config.js',
    '**/.eslintrc.js',
    'jest.config.ts',
    '**/dist*/',
    '**/android/',
    '**/ios/',
    'jest.resolver.js',
    'rollup.config.js',
    'jest-preload.js',
    'webpack.config.js',
    '**/coverage/**',
  ],

  overrides: [
    {
      files: ['**/*.js'],
      extends: ['@metamask/eslint-config-nodejs'],
    },

    {
      files: ['**/*.ts'],
      extends: ['@metamask/eslint-config-typescript'],
      rules: {
        '@typescript-eslint/consistent-type-definitions': [
          'error',
          'interface',
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        'no-async-promise-executor': 'error',
        'import/no-named-as-default': 0,
        'no-shadow': 'off',
        '@typescript-eslint/no-shadow': ['error'],
      },
    },
    {
      files: ['**/*.d.ts'],
      rules: {
        'import/unambiguous': 'off',
      },
    },
  ],
};
