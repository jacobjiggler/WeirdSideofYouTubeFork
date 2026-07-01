var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// A public video/playlist suggestion awaiting admin moderation.
var Submission = new Schema({
  type:        { type: String, enum: ['video', 'playlist'], required: true },
  sourceId:    { type: String, required: true },   // the extracted YouTube video id or playlist id
  originalUrl: { type: String },                   // what the submitter pasted (stored for context)
  userAgent:   { type: String },
  ip:          { type: String },
  status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  note:        { type: String },                   // admin note / result summary
  time:        { type: Date, default: Date.now }
});

Submission.index({ status: 1, time: -1 });

module.exports = mongoose.model('Submission', Submission);
