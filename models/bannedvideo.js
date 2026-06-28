var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var BannedVideo = new Schema({
  _id: Number,
  videoID: String,
});

BannedVideo.index({ _id: 1 }, { unique: true });
BannedVideo.index({ videoID: 1 }, { unique: true });

module.exports = mongoose.model('BannedVideo', BannedVideo);
