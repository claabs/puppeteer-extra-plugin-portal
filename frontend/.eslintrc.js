module.exports = {
  root: true,
  env: {
    browser: true,
  },
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:promise/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './frontend/tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    'no-console': 0,
  },
  overrides: [
    {
      files: ['webpack.config.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 0,
      },
    },
  ],
  ignorePatterns: ['**/dist', '**/node_modules', '!.*rc.js'],
};
