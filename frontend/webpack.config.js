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
      {
        test: /\.(png|jpe?g|gif)$/i,
        use: ['file-loader'],
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

module.exports = [main];
