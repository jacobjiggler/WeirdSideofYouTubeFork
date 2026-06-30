#!/bin/env node
// Usage: node tools/reset_password.js <username> <newpassword>

var mongoose = require('mongoose');
var Account = require('../models/account');
var database = require('../config/db');

mongoose.connect(database.url);

var username = process.argv[2];
var newPassword = process.argv[3];

if (!username || !newPassword) {
  console.error('Usage: node tools/reset_password.js <username> <newpassword>');
  process.exit(1);
}

async function main() {
  var user = await Account.findByUsername(username);
  if (!user) {
    console.error('User not found: ' + username);
    process.exit(1);
  }
  await user.setPassword(newPassword);
  await user.save();
  console.log('Password updated successfully for ' + username);
  process.exit(0);
}

main().catch(function (err) {
  console.error('Error resetting password: ' + err.message);
  process.exit(1);
});
