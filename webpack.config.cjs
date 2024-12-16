const path = require('path');
const nodeExternals = require('webpack-node-externals'); 

module.exports = {
  entry: './src/index.js',
  target: 'node',
  externals: [nodeExternals()],
  mode: 'production',
  output: {
    filename: 'bundle.cjs',
    path: path.resolve(__dirname, 'dist')
  }
};
