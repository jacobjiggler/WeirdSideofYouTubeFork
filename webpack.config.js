var path = require('path');

// Bundles the browser entry points (TypeScript) into dist/. esbuild-loader
// transpiles the .ts sources (fast, no type-checking — same philosophy as tsx on
// the server). No CSS is imported through JS, so no other loaders are needed.
module.exports = {
  mode: 'production',
  entry: {
    videos: './frontend/videos.ts',
    admin: './frontend/admin.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'esbuild-loader',
        options: { target: 'es2018' }
      }
    ]
  }
};
