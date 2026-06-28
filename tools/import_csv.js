#!/bin/env node

var fs = require('fs');
var path = require('path');
var mongoose = require('mongoose');
var api = require('../controllers/api.js');
var database = require('../config/db');

mongoose.connect(database.url);

var csvPath = path.join(__dirname, '..', 'InitialSources.csv');
var lines = fs.readFileSync(csvPath, 'utf8').split('\n');

// skip header row, filter blank lines
var urls = lines.slice(1).map(function(l) {
  var parts = l.split(',');
  return parts[1] && parts[1].trim();
}).filter(Boolean);

console.log('Found ' + urls.length + ' URLs to import...');

var added = 0;
var skipped = 0;
var errors = 0;
var index = 0;

function next() {
  if (index >= urls.length) {
    console.log('\nDone. Added: ' + added + ', Skipped (duplicate/banned): ' + skipped + ', Errors: ' + errors);
    process.exit(0);
  }

  var url = urls[index++];
  api.addVideo(url, function(err, vid) {
    if (err) {
      console.error('ERROR adding ' + url + ': ' + err.message);
      errors++;
    } else {
      if (vid && vid.videoID) {
        process.stdout.write('Added [' + index + '/' + urls.length + ']\r');
        added++;
      } else {
        skipped++;
      }
    }
    next();
  });
}

next();
