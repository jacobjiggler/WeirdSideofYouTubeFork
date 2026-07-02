#!/bin/env node

// Add every video from a YouTube playlist to the database, skipping any that are
// already present or banned. Read-only against YouTube; additive to the DB.
//
//   node tools/add_playlist.js <playlistIdOrUrl>
//
// Accepts a bare playlist id (PL..., UU..., etc.) or any YouTube URL containing
// a &list= parameter.

var mongoose = require('mongoose');
var api = require('../controllers/api');
var Video = require('../models/video');
var database = require('../config/db');

var API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) { console.error('YOUTUBE_API_KEY is not set.'); process.exit(1); }

var arg = process.argv[2] || '';
var m = arg.match(/[?&]list=([A-Za-z0-9_-]+)/);
var playlistId = m ? m[1] : arg;
if (!/^[A-Za-z0-9_-]{10,50}$/.test(playlistId)) {
  console.error('Usage: node tools/add_playlist.js <playlistIdOrUrl>');
  process.exit(1);
}

function addVideoPromise(id) {
  return new Promise(function (resolve) {
    api.addVideo(id, function (err, vid) {
      if (err) resolve('error');
      else if (vid && vid.videoID) resolve('added');   // new doc
      else resolve('skipped');                          // already present or banned
    });
  });
}

mongoose.connect(database.url).then(async function () {
  // Collect every video id in the playlist (paginated).
  var ids = [], pageToken = '', pages = 0;
  do {
    var url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=' +
      encodeURIComponent(playlistId) + '&key=' + API_KEY + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    var resp = await fetch(url);
    if (!resp.ok) {
      console.error('YouTube API error: HTTP ' + resp.status + ' ' + (await resp.text()));
      process.exit(1);
    }
    var data = await resp.json();
    (data.items || []).forEach(function (it) {
      if (it.contentDetails && it.contentDetails.videoId) ids.push(it.contentDetails.videoId);
    });
    pageToken = data.nextPageToken || '';
    pages++;
  } while (pageToken && pages < 40);   // hard cap: 2000 videos

  console.log('Playlist ' + playlistId + ' — ' + ids.length + ' videos found.');

  var added = 0, skipped = 0, errors = 0;
  for (var i = 0; i < ids.length; i++) {
    var r = await addVideoPromise(ids[i]);
    if (r === 'added') added++;
    else if (r === 'skipped') skipped++;
    else errors++;
    process.stdout.write('Processed ' + (i + 1) + '/' + ids.length + '\r');
  }

  console.log('\nDone. Added: ' + added + ' | Skipped (already present/banned): ' + skipped + ' | Errors: ' + errors);
  console.log('Total videos in DB now: ' + (await Video.countDocuments()));
  process.exit(0);
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});
