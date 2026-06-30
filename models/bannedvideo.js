var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var BannedVideo = new Schema({
  _id: Number,
  videoID: String,
});

// _id is indexed uniquely by MongoDB automatically; only videoID needs one.
BannedVideo.index({ videoID: 1 }, { unique: true });

module.exports = mongoose.model('BannedVideo', BannedVideo);
