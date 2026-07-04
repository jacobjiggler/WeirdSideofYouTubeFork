import { Schema, model } from 'mongoose';

const BannedVideo = new Schema({
  _id: Number,
  videoID: String
});

// _id is indexed uniquely by MongoDB automatically; only videoID needs one.
BannedVideo.index({ videoID: 1 }, { unique: true });

export = model('BannedVideo', BannedVideo);
