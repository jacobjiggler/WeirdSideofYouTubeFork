// Invoke 'strict' JavaScript mode
'use strict';

var mongoose = require('mongoose');
var Video = require('../models/video');
var Counter = require('../models/counters');
var VideoHistory = require('../models/videohistory');
var Chance = require('chance');
var chance = new Chance();
var request = require('request');
var BannedVideo = require('../models/bannedvideo');

// internal function for adding a video to the database
exports.addVideo = function (video_url_or_id, callback)
{
  var video_split = video_url_or_id.match(/(?:https?:\/{2})?(?:w{3}\.)?youtu(?:be)?\.(?:com|be)(?:\/watch\?v=|\/)([^\s&\?]+)/);
  var vidID = video_url_or_id;
  if(video_url_or_id != null && video_split != null)
  {
    vidID = video_split[1];
  }
  BannedVideo.findOne({ 'videoID': vidID }, function (error, vid)
  {
    if (!vid)
    {
      Video.findOne({ 'videoID': vidID }, function (error, vid)
      {
        if (!vid)
        {
          Counter.findByIdAndUpdate('videos', { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }, function (error, counter)
          {
            if (error)
              return callback(error);
            Video.create({ 'videoID': vidID, '_id': counter.seq }, function (err, vid)
            {
              if (err)
                console.log(err);
              callback(err, vid);
            });
          });
        }
        else
        {
          callback(null, vidID);
        }
      });
    }
    else
    {
      callback(null, vidID);
    }
  });
};

exports.removeVideoNoParse = function (vidID)
{
  BannedVideo.findOne({ 'videoID': vidID }, function (error, vid)
  {
    if (!vid)
    {
      Counter.findByIdAndUpdate('bannedvideos', { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }, function (error, counter)
      {
        if (error)
          return console.error(error);
        BannedVideo.create({ 'videoID': vidID, '_id': counter.seq }, function (err, vid)
        {
          if (err)
            console.log(err);
        });
      });
    }
  });

  Video.findOne({ 'videoID': vidID }, function (error, video)
  {
    if (!video) return;
    var __id = video._id;
    Counter.findById('videos', function (error, counter)
    {
      if (!counter) return;
      Video.findOne({ '_id': counter.seq }, function (error, _video)
      {
        if (!_video) return;
        video.remove();
        Video.create({ 'videoID': _video.videoID, '_id': __id }, function (err, vid)
        {
          _video.remove();
          counter.seq = counter.seq - 1;
          counter.save();
        });
      });
    });
  });
};

// internal function for removing a video by youtube ID
exports.removeVideo = function (video_url_or_id)
{
  var video_split = video_url_or_id.match(/(?:https?:\/{2})?(?:w{3}\.)?youtu(?:be)?\.(?:com|be)(?:\/watch\?v=|\/)([^\s&\?]+)/);
  var vidID = video_url_or_id;
  if(video_url_or_id != null && video_split != null)
  {
    vidID = video_split[1];
  }
  if (vidID)
  {
    exports.removeVideoNoParse(vidID);
  }
};

// internal function for getting a random youtube ID
exports.randomVideoID = function (user, callback)
{
  Counter.findById('videos', function (err, count)
  {
    // DB is empty — no videos yet
    if (err) return callback(err, null);
    if (!count || count.seq < 1) return callback(null, null);

    var rand = chance.integer({ min: 1, max: count.seq });
    if(user)
    {
      var currentVideoHistory = VideoHistory.find({ username: user.username }, { '_id': 0, 'videoID': 1 }).sort({ time: -1 }).limit(Math.min(50, count.seq / 2));
      var loopExitCounter = 0;
      while (loopExitCounter < 5)
      {
        rand = chance.integer({ min: 1, max: count.seq });
        var vid_id;
        Video.findById(rand, function (err, myDocument)
        {
          if (myDocument) vid_id = myDocument.videoID;
        });
        if (currentVideoHistory.findOne(vid_id) != -1)
        {
          break;
        }
        loopExitCounter++;
      }
    }

    Video.findByIdAndUpdate(rand, { $inc: { views: 1 } }, function (err, myDocument)
    {
      if (err) return callback(err, null);
      if (!myDocument) return callback(null, null);

      if (user)
      {
        VideoHistory.create({ 'username': user.username, 'videoID': myDocument.videoID }, function (err, vid)
        {
          if (err) console.log(err);
        });
      }
      callback(null, myDocument.videoID);
    });
  });
};

// Handler for a GET request for a random video
exports.getRandomVid = function (req, res)
{
  exports.randomVideoID(req.user, function (err, vidID)
  {
    if (err) return res.status(500).json({ error: err.message });
    if (!vidID) return res.status(503).json({ error: 'No videos in database yet' });
    res.json({ 'vidID': vidID });
  });
};

// handler for a GET request for a range of videos
exports.getVidRange = function (req, res)
{
  var start_id = parseInt(req.params.start);
  var end_id = parseInt(req.params.end);
  Counter.findById('videos', function (error, counter)
  {
    if (!counter) return res.json([]);

    var smallestID = 1;

    if (start_id < smallestID) start_id = smallestID;
    if (end_id < start_id) end_id = start_id;

    var len = end_id - start_id + 1;
    if (len > 50) len = 50;

    Video.find({ _id: { $gte: start_id } }, { 'videoID': 1 }).limit(len).lean().exec(function (err, docs)
    {
      res.json(docs);
    });
  });
};

// handler for a GET request for a user's video history
exports.getVideoHistory = function (req, res)
{
  if (req.user)
  {
    VideoHistory.find({ username: req.user.username }, { '_id': 0, 'videoID': 1, 'time': 1 }).sort({ time: -1 }).limit(50).exec(function (error, history)
    {
      res.json(history);
    });
  }
  else
  {
    res.status(401).send('User is not logged in');
  }
};

// handler for a GET request for the number of videos in the database
exports.getNumVids = function (req, res)
{
  Counter.findById('videos', function (err, count)
  {
    res.json({ 'numVids': count ? count.seq : 0 });
  });
};

// handler for a GET request for the number of banned videos
exports.getNumBannedVids = function (req, res)
{
  Counter.findById('bannedvideos', function (err, count)
  {
    res.json({ 'numBannedVids': count ? count.seq : 0 });
  });
};

// handler for a request for video information from the YouTube API
exports.getVideoInfo = function (req, res)
{
  var youtubeAPIKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeAPIKey) {
    return res.status(500).json({ error: 'YOUTUBE_API_KEY environment variable is not set' });
  }
  request('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + req.params.videoID + '&key=' + youtubeAPIKey, function (error, response, body)
  {
    if (!error && response.statusCode == 200)
    {
      res.send(body);
    }
  });
};
