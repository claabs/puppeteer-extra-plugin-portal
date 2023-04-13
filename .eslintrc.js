module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:prettier/recommended',
    'plugin:promise/recommended',
  ],
  overrides: [
    {
      files: ['**/*.test.ts'],
      plugins: ['jest'],
      extends: ['plugin:jest/all'],
      rules: {
        'jest/no-hooks': 'off',
        '@typescript-eslint/no-var-requires': 0,
        'global-require': 0,
      },
    },
    {
      files: ['**/!(*.test).ts'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
      ],
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  rules: {
    'import/extensions': 0,
    'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/*.test.ts'] }],
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: false,
      },
    ],
  },
  ignorePatterns: ['**/dist', '**/node_modules', '!.*rc.js'],
};
