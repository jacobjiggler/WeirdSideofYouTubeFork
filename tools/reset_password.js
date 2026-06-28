#!/bin/env node
// Usage: node tools/reset_password.js <username> <newpassword>

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var Account = require('../models/account');
var database = require('../config/db');

mongoose.connect(database.url);

var username = process.argv[2];
var newPassword = process.argv[3];

if (!username || !newPassword) {
  console.error('Usage: node tools/reset_password.js <username> <newpassword>');
  process.exit(1);
}

Account.findByUsername(username, function(err, user) {
  if (err || !user) {
    console.error('User not found: ' + username);
    process.exit(1);
  }
  user.setPassword(newPassword, function(err) {
    if (err) {
      console.error('Error setting password: ' + err.message);
      process.exit(1);
    }
    user.save(function(err) {
      if (err) {
        console.error('Error saving user: ' + err.message);
        process.exit(1);
      }
      console.log('Password updated successfully for ' + username);
      process.exit(0);
    });
  });
});
