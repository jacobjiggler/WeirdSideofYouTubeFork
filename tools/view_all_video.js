#!/bin/env node

var mongoose = require('mongoose');
var Counter = require('../models/counters.js');

var database = require('../config/db');

var Video = require('../models/video.js');
var BannedVideo = require('../models/bannedvideo.js');

mongoose.connect(database.url);

async function main()
{
  var videos = await Video.find({});
  videos.forEach(function(doc)
  {
    console.info('VidID: ' + doc.videoID);
  });

  var banned = await BannedVideo.find({});
  banned.forEach(function(doc)
  {
    console.info('Banned VidID: ' + doc.videoID);
  });

  var bannedCount = await Counter.findById('bannedvideos');
  console.info((bannedCount ? bannedCount.seq : 0) + ' banned videos exist');

  var videoCount = await Counter.findById('videos');
  console.info((videoCount ? videoCount.seq : 0) + ' known videos exist');

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(function (err)
{
  console.error(err);
  process.exit(1);
});
