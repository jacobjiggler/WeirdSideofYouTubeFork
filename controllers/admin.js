// Invoke 'strict' JavaScript mode
'use strict';

var Video = require('../models/video');
var Counter = require('../models/counters');
var Submission = require('../models/submission');
var api = require('./api');
var reddit = require('./reddit');

// Promise wrapper around the callback-based api.addVideo.
function addVideoPromise(idOrUrl) {
  return new Promise(function (resolve, reject) {
    api.addVideo(idOrUrl, function (err, vid) {
      if (err) reject(err); else resolve(vid);
    });
  });
}

// Expand a playlist into individual videos via the YouTube API and add each.
// Capped at 4 pages (200 videos) to bound abuse from a huge playlist.
async function addPlaylist(playlistId) {
  var key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not set');
  var added = 0, pageToken = '', pages = 0;
  do {
    var url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=' +
      encodeURIComponent(playlistId) + '&key=' + key + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    var resp = await fetch(url);
    if (!resp.ok) break;
    var data = await resp.json();
    var items = data.items || [];
    for (var i = 0; i < items.length; i++) {
      var vidId = items[i].contentDetails && items[i].contentDetails.videoId;
      if (vidId) { await addVideoPromise(vidId); added++; }
    }
    pageToken = data.nextPageToken || '';
    pages++;
  } while (pageToken && pages < 4);
  return added;
}

//middleware for requiring admin permissions
exports.needsAdmin = function(req, res, next) {
  if (req.user && req.user.admin === true){
    return next();
  }
  else{
    res.redirect('/login');
  }
};

// render the admin panel index
exports.getIndex = function(req, res) {
  res.render('admin/index', { user : req.user, csrfToken: req.csrfToken() });
};

// handles the POST request for submitting a video
exports.postSubmitVid = function(req, res) {
  api.addVideo(req.body.videoID, function(err, _vid){
    if(err)
      console.log(err);
    else
        res.redirect('/admin');
  });
};

// handles the POST request for removing a video
exports.postRemoveVid = function(req, res) {
  api.removeVideo(req.body.videoID);
  res.redirect('/admin');
};

// Privileged version of /api/getVidRange
exports.getVidRangeAdmin = async function(req, res) {
  try
  {
    var start_id = parseInt(req.params.start);
    var end_id = parseInt(req.params.end);
    await Counter.findById('videos');

    var smallestID = 1;

    if(start_id < smallestID)
    {
      start_id = smallestID;
    }
    if(end_id < start_id)
    {
      end_id = start_id;
    }
    var len = end_id - start_id + 1;
    if(len > 50)
    {
      len = 50;
    }

    var docs = await Video.find({_id: {$gte: start_id }}, {'_id':1, 'videoID':1, 'views':1, 'errorCount':1, 'skips':1, 'time':1, 'submittedUser':1}).limit(len).lean();
    res.json(docs);
  }
  catch (err)
  {
    res.status(500).json({ error: err.message });
  }
};

// handles the POST request for crawling reddit
exports.postCrawlReddit = function(req, res) {
  reddit.crawlReddit();
  res.redirect('/admin');
};

// ── Public-submission moderation ──────────────────────────────────────────────

// Render the moderation queue: pending submissions + recent decisions.
exports.getSubmissions = async function (req, res) {
  try {
    var pending = await Submission.find({ status: 'pending' }).sort({ time: -1 }).limit(200).lean();
    var recent = await Submission.find({ status: { $in: ['approved', 'rejected'] } }).sort({ time: -1 }).limit(20).lean();
    res.render('admin/submissions', {
      user: req.user,
      csrfToken: req.csrfToken(),
      pending: pending,
      recent: recent
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading submissions');
  }
};

// Approve a pending submission: add the video, or expand + add the playlist.
exports.postApproveSubmission = async function (req, res) {
  try {
    var id = String((req.body && req.body.id) || '');
    var sub = await Submission.findById(id);
    if (sub && sub.status === 'pending') {
      var result;
      if (sub.type === 'video') {
        await addVideoPromise(sub.sourceId);
        result = 'added video ' + sub.sourceId;
      } else {
        var count = await addPlaylist(sub.sourceId);
        result = 'added ' + count + ' video(s) from playlist';
      }
      sub.status = 'approved';
      sub.note = result;
      await sub.save();
    }
  } catch (err) {
    console.error(err);
  }
  res.redirect('/admin/submissions');
};

// Reject a pending submission (kept for the audit trail, not deleted).
exports.postRejectSubmission = async function (req, res) {
  try {
    var id = String((req.body && req.body.id) || '');
    await Submission.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'rejected', note: 'rejected by admin' } });
  } catch (err) {
    console.error(err);
  }
  res.redirect('/admin/submissions');
};
