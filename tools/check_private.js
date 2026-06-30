#!/bin/env node

// Checks every video in the DB against the YouTube API and reports which ones
// are unavailable (deleted or made private — the API returns nothing for either
// to a non-owner), and which are public but not embeddable (won't play in our
// iframe). Read-only: it does not modify the database.
//
//   node tools/check_private.js            # report only
//   node tools/check_private.js --json     # machine-readable output

var mongoose = require('mongoose');
var Video = require('../models/video');
var database = require('../config/db');

var API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('YOUTUBE_API_KEY is not set.');
  process.exit(1);
}

var asJson = process.argv.indexOf('--json') !== -1;

mongoose.connect(database.url);

Video.find({}, { _id: 1, videoID: 1 }).lean().exec(function (err, vids) {
  if (err) { console.error(err); process.exit(1); }

  var allIds = vids.map(function (v) { return v.videoID; });

  // A valid YouTube ID is exactly 11 chars of [A-Za-z0-9_-]. Anything else
  // (a full URL, blank, junk) can't be queried and is itself a data problem.
  var malformed = [];
  var ids = [];
  allIds.forEach(function (id) {
    if (typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id)) ids.push(id);
    else malformed.push(id);
  });

  if (!asJson) console.log('Checking ' + ids.length + ' videos against the YouTube API...\n');

  var unavailable = [];   // deleted or private (not returned by the API)
  var notEmbeddable = []; // public but blocks embedding
  var batches = [];
  for (var i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));

  var b = 0;
  function nextBatch() {
    if (b >= batches.length) return report();

    var batch = batches[b++];
    var encodedIds = batch.map(encodeURIComponent).join(',');
    var url = 'https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=' +
      encodedIds + '&key=' + API_KEY;

    fetch(url).then(function (response) {
      return response.text().then(function (body) { return { status: response.status, body: body }; });
    }).then(function (r) {
      if (r.status !== 200) {
        console.error('\nAPI error on batch ' + b + ': HTTP ' + r.status + ' ' + r.body);
        process.exit(1);
      }

      var data = JSON.parse(r.body);
      var returned = {};
      data.items.forEach(function (item) {
        returned[item.id] = item;
        if (item.status && item.status.embeddable === false) {
          notEmbeddable.push({ videoID: item.id, title: item.snippet ? item.snippet.title : '' });
        }
      });

      batch.forEach(function (id) {
        if (!returned[id]) unavailable.push(id);
      });

      if (!asJson) process.stdout.write('Checked batch ' + b + '/' + batches.length + '\r');
      nextBatch();
    }).catch(function (e) {
      console.error('\nAPI error on batch ' + b + ': ' + e.message);
      process.exit(1);
    });
  }

  function report() {
    if (asJson) {
      console.log(JSON.stringify({
        total: allIds.length,
        checked: ids.length,
        unavailable: unavailable,
        notEmbeddable: notEmbeddable,
        malformed: malformed
      }, null, 2));
      process.exit(0);
    }

    console.log('\n\n===== Results =====');
    console.log('Total videos in DB:            ' + allIds.length);
    console.log('Checked against API:           ' + ids.length);
    console.log('Unavailable (deleted/private): ' + unavailable.length);
    console.log('Public but not embeddable:     ' + notEmbeddable.length);
    console.log('Malformed IDs (bad data):      ' + malformed.length);

    if (unavailable.length) {
      console.log('\n--- Unavailable (deleted or private) ---');
      unavailable.forEach(function (id) {
        console.log('  ' + id + '   https://www.youtube.com/watch?v=' + id);
      });
    }

    if (notEmbeddable.length) {
      console.log('\n--- Public but embedding disabled (won\'t play on the site) ---');
      notEmbeddable.forEach(function (v) {
        console.log('  ' + v.videoID + '   ' + v.title);
      });
    }

    if (malformed.length) {
      console.log('\n--- Malformed IDs (not valid YouTube IDs — bad DB data) ---');
      malformed.forEach(function (id) {
        console.log('  ' + JSON.stringify(id));
      });
    }

    if (!unavailable.length && !notEmbeddable.length && !malformed.length) {
      console.log('\nAll videos are public and embeddable. ✅');
    }
    process.exit(0);
  }

  nextBatch();
});
