import { Schema, model } from 'mongoose';

const VideoCache = new Schema({
  _id: String,
  cache: [],
  time: { type: Date, default: Date.now }
});

export = model('VideoCache', VideoCache);
