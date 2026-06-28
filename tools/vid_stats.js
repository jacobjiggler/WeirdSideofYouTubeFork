#!/bin/env node

// NOTE: vid_stats.js in the original repo had syntax errors and used raw db.*
// calls that don't work with Mongoose. This is a corrected version.

var mongoose = require('mongoose');
var Video = require('../models/video.js');
var Counter = require('../models/counters.js');

var database = require('../config/db');
mongoose.connect(database.url);

Counter.findById('videos', function(err, count) {
  if (err) return console.error(err);
  console.log('Total videos:', count ? count.seq : 0);

  Video.aggregate([
    {
      $group: {
        _id: null,
        totalViews:  { $sum: '$views' },
        totalErrors: { $sum: '$errorCount' },
        totalSkips:  { $sum: '$skips' }
      }
    }
  ], function(err, result) {
    if (err) return console.error(err);
    if (result.length) {
      console.log('Total views:', result[0].totalViews);
      console.log('Total errors:', result[0].totalErrors);
      console.log('Total skips:', result[0].totalSkips);
    }
    mongoose.connection.close();
    process.exit(0);
  });
});
