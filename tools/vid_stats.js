#!/bin/env node

// NOTE: vid_stats.js in the original repo had syntax errors and used raw db.*
// calls that don't work with Mongoose. This is a corrected version.

var mongoose = require('mongoose');
var Video = require('../models/video.js');
var Counter = require('../models/counters.js');

var database = require('../config/db');
mongoose.connect(database.url);

async function main() {
  var count = await Counter.findById('videos');
  console.log('Total videos:', count ? count.seq : 0);

  var result = await Video.aggregate([
    {
      $group: {
        _id: null,
        totalViews:  { $sum: '$views' },
        totalErrors: { $sum: '$errorCount' },
        totalSkips:  { $sum: '$skips' }
      }
    }
  ]);
  if (result.length) {
    console.log('Total views:', result[0].totalViews);
    console.log('Total errors:', result[0].totalErrors);
    console.log('Total skips:', result[0].totalSkips);
  }
  await mongoose.connection.close();
  process.exit(0);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
