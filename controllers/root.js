var passport = require('passport');
var api = require('./api');

// Invoke 'strict' JavaScript mode
'use strict';

// handler for a GET request for the index
exports.getIndex = function(req, res) {
  if (!req.session.seenVideos) req.session.seenVideos = [];
  api.randomVideoID(req.session.seenVideos, function(err, doc)
  {
    if (err) return res.status(500).send('Database error');
    var videoID = '';
    if (doc) {
      videoID = doc.videoID;
      req.session.seenVideos.push(doc.videoID);
    }
    res.render('index', { videoID: videoID, user: req.user });
  });
};

// handler for a GET request for the login page
exports.getLogin = function(req, res) {
  res.render('login', { user : req.user, csrfToken: req.csrfToken() });
};

// handler for the POST request for logging in a user
exports.postLogin = function(req, res) {
  passport.authenticate('local')(req, res, function () {
    res.redirect('/');
  });
};

// handler for the GET request for logging out a user
exports.getLogout = function(req, res) {
  req.logout();
  res.redirect('/');
};

// handler for the GET request for the about page
exports.getAbout = function(req, res) {
  res.render('about', { user : req.user });
};

// handler for the GET request for the "but why though?" page
exports.getButWhy = function(req, res) {
  res.render('butwhy', { user : req.user });
};

// handler for the GET request for the history page
exports.getHistory = function(req, res) {
  if(req.user)
  {
    res.render('history', { user : req.user });
  }
  else
  {
    res.redirect('/');
  }
};
