/* eslint-disable import/no-extraneous-dependencies */
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import fs from 'fs';
import type { IPackageJson } from 'package-json-type';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8')) as Required<IPackageJson>;

const entryFile = 'index';

const defaultExportOutro = `
  module.exports = exports.default || {}
  Object.entries(exports).forEach(([key, value]) => { module.exports[key] = value })
`;

export default {
  input: `src/${entryFile}.ts`,
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      outro: defaultExportOutro,
    },
    {
      file: pkg.module as string,
      format: 'es',
      sourcemap: true,
      exports: 'named',
    },
  ],
  // Indicate here external modules you don't wanna include in your bundle (i.e.: 'lodash')
  external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
  watch: {
    include: 'src/**',
  },
  plugins: [
    // Compile TypeScript files
    typescript(),
    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve(),
  ],
};
