const path = require('path');
const HtmlWebPackPlugin = require('html-webpack-plugin');

const srcDir = path.resolve(__dirname, 'src');
const outputDir = path.resolve(__dirname, '..', 'dist', 'frontend');

const main = {
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.worker\.js$/,
        use: { loader: 'worker-loader' },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  entry: path.join(srcDir, 'index.ts'),
  output: {
    path: outputDir,
    filename: 'index.bundle.js',
  },
  devtool: 'inline-source-map',
  optimization: {
    // minimize: false,
  },
  plugins: [
    new HtmlWebPackPlugin({
      title: 'Puppeteer Portal',
      template: path.join(srcDir, 'index.html'),
      hash: true,
      publicPath: './',
    }),
  ],
};

const worker = {
  target: 'webworker',
  mode: 'development',
  devtool: 'inline-source-map',
  entry: {
    'puppeteer.worker': path.join(srcDir, 'puppeteer.worker.ts'),
  },
  resolve: {
    fallback: {
      path: require.resolve('path-browserify'),
      fs: false,
    },
    extensions: ['.ts', '.js'],
  },
  output: {
    globalObject: 'self',
    filename: '[name].bundle.js',
    path: outputDir,
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
};

module.exports = [main, worker];
