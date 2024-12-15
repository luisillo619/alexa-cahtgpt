// webpack.config.js
const path = require('path');
const nodeExternals = require('webpack-node-externals'); // Instala antes con: npm install webpack-node-externals --save-dev

module.exports = {
  entry: './src/index.js',
  target: 'node',
  externals: [nodeExternals()],
  mode: 'production',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  }
};
