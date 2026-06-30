// Invoke 'strict' JavaScript mode
'use strict';

var mongoose = require('mongoose');
var Video = require('../models/video');
var Counter = require('../models/counters');
var VideoHistory = require('../models/videohistory');
var Chance = require('chance');
var chance = new Chance();
var BannedVideo = require('../models/bannedvideo');

// internal function for adding a video to the database.
// Keeps its callback signature (callback(err, vidOrId)) so route handlers and
// the tools/* CLIs don't change; the Mongoose calls inside are now promise-based
// (Mongoose 7+ dropped callbacks). On a new video it calls back with the created
// doc; on a duplicate/banned video it calls back with the plain id string (callers
// distinguish "added" from "skipped" by checking for .videoID).
exports.addVideo = async function (video_url_or_id, callback)
{
  var video_split = video_url_or_id.match(/(?:https?:\/{2})?(?:w{3}\.)?youtu(?:be)?\.(?:com|be)(?:\/watch\?v=|\/)([^\s&\?]+)/);
  var vidID = video_url_or_id;
  if(video_url_or_id != null && video_split != null)
  {
    vidID = video_split[1];
  }
  try
  {
    var banned = await BannedVideo.findOne({ 'videoID': vidID });
    if (banned) return callback(null, vidID);

    var existing = await Video.findOne({ 'videoID': vidID });
    if (existing) return callback(null, vidID);

    var counter = await Counter.findByIdAndUpdate('videos', { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    var vid = await Video.create({ 'videoID': vidID, '_id': counter.seq });
    callback(null, vid);
  }
  catch (err)
  {
    console.log(err);
    callback(err);
  }
};

exports.removeVideoNoParse = async function (vidID)
{
  try
  {
    var banned = await BannedVideo.findOne({ 'videoID': vidID });
    if (!banned)
    {
      var bannedCounter = await Counter.findByIdAndUpdate('bannedvideos', { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
      await BannedVideo.create({ 'videoID': vidID, '_id': bannedCounter.seq });
    }

    var video = await Video.findOne({ 'videoID': vidID });
    if (!video) return;
    var __id = video._id;
    var counter = await Counter.findById('videos');
    if (!counter) return;
    // Move the highest-_id video into the freed slot so _id stays contiguous
    // 1..seq (admin tooling and getVidRange rely on this).
    var _video = await Video.findOne({ '_id': counter.seq });
    if (!_video) return;
    await video.deleteOne();
    await Video.create({ 'videoID': _video.videoID, '_id': __id });
    await _video.deleteOne();
    counter.seq = counter.seq - 1;
    await counter.save();
  }
  catch (err)
  {
    console.error(err);
  }
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

// Returns a random video doc that isn't in seenVideoIDs.
// If all videos have been seen, resets seenVideoIDs to [] and retries once so
// the session can loop the catalog forever without hitting a dead end.
// Keeps its callback signature; Video.aggregate is promise-based now.
exports.randomVideoID = function (seenVideoIDs, callback)
{
  Video.aggregate([
    { $match: { videoID: { $nin: seenVideoIDs } } },
    { $sample: { size: 1 } }
  ]).then(function (docs)
  {
    if (!docs.length)
    {
      if (seenVideoIDs.length === 0) return callback(null, null); // DB truly empty
      return exports.randomVideoID([], callback);                  // exhausted → reset & retry
    }
    var doc = docs[0];
    // Fire-and-forget view bump; failures here must not break playback.
    Video.findByIdAndUpdate(doc._id, { $inc: { views: 1 } }).catch(function () {});
    callback(null, doc);
  }, function (err)
  {
    callback(err);
  });
};

// Handler for a GET request for a random video
exports.getRandomVid = function (req, res)
{
  if (!req.session.seenVideos) req.session.seenVideos = [];
  exports.randomVideoID(req.session.seenVideos, function (err, doc)
  {
    if (err) return res.status(500).json({ error: err.message });
    if (!doc) return res.status(503).json({ error: 'No videos in database yet' });
    req.session.seenVideos.push(doc.videoID);
    if (req.user)
    {
      VideoHistory.create({
        'username': req.user.username,
        'videoID': doc.videoID,
        'userAgent': (req.headers && req.headers['user-agent']) || ''
      })
        .catch(function (err) { console.log(err); });
    }
    res.json({ 'vidID': doc.videoID });
  });
};

// handler for a GET request for a range of videos
exports.getVidRange = async function (req, res)
{
  try
  {
    var start_id = parseInt(req.params.start);
    var end_id = parseInt(req.params.end);
    var counter = await Counter.findById('videos');
    if (!counter) return res.json([]);

    var smallestID = 1;

    if (start_id < smallestID) start_id = smallestID;
    if (end_id < start_id) end_id = start_id;

    var len = end_id - start_id + 1;
    if (len > 50) len = 50;

    var docs = await Video.find({ _id: { $gte: start_id } }, { 'videoID': 1 }).limit(len).lean();
    res.json(docs);
  }
  catch (err)
  {
    res.status(500).json({ error: err.message });
  }
};

// handler for a GET request for a user's video history
exports.getVideoHistory = async function (req, res)
{
  if (!req.user)
  {
    return res.status(401).send('User is not logged in');
  }
  try
  {
    var history = await VideoHistory.find({ username: req.user.username }, { '_id': 0, 'videoID': 1, 'time': 1, 'userAgent': 1 }).sort({ time: -1 }).limit(50);
    res.json(history);
  }
  catch (err)
  {
    res.status(500).json({ error: err.message });
  }
};

// handler for a GET request for the number of videos in the database
exports.getNumVids = async function (req, res)
{
  try
  {
    var count = await Counter.findById('videos');
    res.json({ 'numVids': count ? count.seq : 0 });
  }
  catch (err)
  {
    res.status(500).json({ error: err.message });
  }
};

// handler for a GET request for the number of banned videos
exports.getNumBannedVids = async function (req, res)
{
  try
  {
    var count = await Counter.findById('bannedvideos');
    res.json({ 'numBannedVids': count ? count.seq : 0 });
  }
  catch (err)
  {
    res.status(500).json({ error: err.message });
  }
};

// handler for a request for video information from the YouTube API
exports.getVideoInfo = function (req, res)
{
  var youtubeAPIKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeAPIKey) {
    return res.status(500).json({ error: 'YOUTUBE_API_KEY environment variable is not set' });
  }
  var url = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' +
    encodeURIComponent(req.params.videoID) + '&key=' + youtubeAPIKey;
  fetch(url)
    .then(function (response) {
      return response.text().then(function (body) {
        if (response.ok) return res.send(body);
        return res.status(502).json({ error: 'YouTube API request failed' });
      });
    })
    .catch(function (err) {
      res.status(502).json({ error: err.message });
    });
};
