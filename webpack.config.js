var path = require('path');

// Bundles the browser entry points into dist/. Native fetch is used directly
// (no whatwg-fetch polyfill — the site targets modern browsers), and no CSS is
// imported through JS, so no loaders are needed — webpack just bundles.
module.exports = {
  mode: 'production',
  entry: {
    videos: './frontend/videos.js',
    admin: './frontend/admin.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  }
};
