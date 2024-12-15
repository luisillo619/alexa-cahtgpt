// webpack.config.js
import path from 'path';
import nodeExternals from 'webpack-node-externals';

export default {
  entry: './src/index.js',
  target: 'node',
  externals: [nodeExternals()],
  mode: 'production',
  output: {
    filename: 'bundle.js',
    path: path.resolve(process.cwd(), 'dist')
  }
};
