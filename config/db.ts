// Read from environment variable, fall back to localhost for running outside Docker.
export = {
  url: process.env.MONGO_URI || 'mongodb://127.0.0.1/weirdtube'
};
