#!/bin/env node

var readline = require('readline');
var mongoose = require('mongoose');
var api = require('../controllers/api.js');

var database = require('../config/db');
mongoose.connect(database.url);

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Read a video ID from stdin
rl.question('Enter a video ID to add: ', function(answer) {
  api.addVideo(answer, function(err, _vid) {
    if(err != null) {
      console.error('There was a problem adding the video');
    } else {
      console.info('Video added successfully!');
    }

    rl.close();
    process.stdin.destroy();
    process.exit(0);
  });
});
