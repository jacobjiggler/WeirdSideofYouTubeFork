// Invoke 'strict' JavaScript mode
'use strict';

var Video = require('../models/video');
var Counter = require('../models/counters');
var api = require('./api');
var reddit = require('./reddit');

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
