#!/bin/env node

// Removes unavailable (deleted/private) videos and repairs malformed IDs, then
// repacks _id to 1..N contiguously so addVideo / removeVideoNoParse / getVidRange
// stay consistent. View counts and other fields are preserved.
//
//   node tools/cleanup_videos.js            # DRY RUN — shows what it would do
//   node tools/cleanup_videos.js --apply    # actually write the changes
//
// Back up the DB first (tools/backup_db.ps1).

var mongoose = require('mongoose');
var Video = require('../models/video');
var Counter = require('../models/counters');
var database = require('../config/db');

var API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) { console.error('YOUTUBE_API_KEY is not set.'); process.exit(1); }

var apply = process.argv.indexOf('--apply') !== -1;
var VALID = /^[A-Za-z0-9_-]{11}$/;

mongoose.connect(database.url);

// Look up a set of IDs against the API; callback gets a map of id -> true for
// every ID the API returned (i.e. public + embeddable-or-not, but existing).
function checkLive(ids, cb) {
  var live = {};
  var batches = [];
  for (var i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
  var b = 0;
  (function next() {
    if (b >= batches.length) return cb(live);
    var batch = batches[b++];
    var url = 'https://www.googleapis.com/youtube/v3/videos?part=status&id=' +
      batch.map(encodeURIComponent).join(',') + '&key=' + API_KEY;
    fetch(url).then(function (res) {
      return res.text().then(function (body) { return { status: res.status, body: body }; });
    }).then(function (r) {
      if (r.status !== 200) {
        console.error('API error: HTTP ' + r.status + ' ' + r.body);
        process.exit(1);
      }
      JSON.parse(r.body).items.forEach(function (it) { live[it.id] = true; });
      next();
    }).catch(function (e) {
      console.error('API error: ' + e.message);
      process.exit(1);
    });
  })();
}

Video.find({}).sort({ _id: 1 }).lean().then(function (docs) {

  // First pass: which well-formed IDs are currently live?
  var wellFormed = docs.filter(function (d) { return VALID.test(d.videoID); })
                       .map(function (d) { return d.videoID; });

  checkLive(wellFormed, function (liveDirect) {
    // Build the list of trim-candidates from malformed IDs (strip #...&...).
    var candidates = [];
    docs.forEach(function (d) {
      if (!VALID.test(d.videoID)) {
        var base = String(d.videoID).split('#')[0].split('&')[0];
        if (VALID.test(base)) candidates.push(base);
      }
    });

    checkLive(candidates, function (liveTrimmed) {
      var keep = [];      // docs to retain (possibly with repaired videoID)
      var removed = [];   // {videoID, reason}
      var repaired = [];  // {from, to}
      var seen = {};      // dedupe by final videoID

      docs.forEach(function (d) {
        var id = d.videoID;
        var finalId = id;
        var reason = null;

        if (VALID.test(id)) {
          if (!liveDirect[id]) reason = 'unavailable (deleted/private)';
        } else {
          var base = String(id).split('#')[0].split('&')[0];
          if (VALID.test(base) && liveTrimmed[base]) {
            finalId = base;
            repaired.push({ from: id, to: base });
          } else {
            reason = VALID.test(base) ? 'trimmed ID also unavailable' : 'malformed/junk ID';
          }
        }

        if (!reason && seen[finalId]) reason = 'duplicate of an existing video';

        if (reason) {
          removed.push({ videoID: id, reason: reason });
        } else {
          seen[finalId] = true;
          keep.push({
            videoID: finalId,
            views: d.views || 0,
            errorCount: d.errorCount || 0,
            skips: d.skips || 0,
            time: d.time || new Date(),
            submittedUser: d.submittedUser || '',
            cache: d.cache || []
          });
        }
      });

      console.log('\n===== Cleanup plan =====');
      console.log('Current videos:   ' + docs.length);
      console.log('Keeping:          ' + keep.length);
      console.log('Removing:         ' + removed.length);
      console.log('Repairing IDs:    ' + repaired.length);

      if (repaired.length) {
        console.log('\n--- ID repairs ---');
        repaired.forEach(function (r) { console.log('  ' + JSON.stringify(r.from) + '  ->  ' + r.to); });
      }
      console.log('\n--- Removals ---');
      removed.forEach(function (r) { console.log('  ' + r.videoID + '   (' + r.reason + ')'); });

      if (!apply) {
        console.log('\nDRY RUN — no changes written. Re-run with --apply to commit.');
        process.exit(0);
      }

      // Repack: reassign _id 1..N in original order, rewrite the collection.
      keep.forEach(function (doc, i) { doc._id = i + 1; });

      console.log('\nApplying changes...');
      Video.deleteMany({}).then(function () {
        return Video.insertMany(keep);
      }).then(function () {
        return Counter.updateOne({ _id: 'videos' }, { $set: { seq: keep.length } }, { upsert: true });
      }).then(function () {
        console.log('Done. ' + keep.length + ' videos remain, counter seq = ' + keep.length + '.');
        process.exit(0);
      }).catch(function (err) {
        console.error('Failed applying changes: ' + err.message);
        process.exit(1);
      });
    });
  });
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
