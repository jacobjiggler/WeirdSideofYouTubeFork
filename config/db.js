module.exports = {
  // Read from environment variable, fall back to localhost for running outside Docker
  url: process.env.MONGO_URI || 'mongodb://127.0.0.1/weirdtube'
};
