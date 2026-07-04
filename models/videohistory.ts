import { Schema, model } from 'mongoose';

const VideoHistory = new Schema({
  username: String,
  videoID: String,
  userAgent: String,
  time: { type: Date, default: Date.now }
}, {
  capped: { size: 10000000 }
});

VideoHistory.index({ username: 1, time: -1 });

export = model('VideoHistory', VideoHistory);
