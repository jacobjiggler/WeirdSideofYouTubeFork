#!/bin/env node
// Non-interactive version: node tools/create_admin_auto.js <username> <password>

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var Account = require('../models/account');
var database = require('../config/db');

mongoose.connect(database.url);

var username = process.argv[2];
var password = process.argv[3];

if (!username || !password) {
  console.error('Usage: node tools/create_admin_auto.js <username> <password>');
  process.exit(1);
}

Account.register(new Account({ username: username, admin: true }), password, function(err, _account) {
  if (err) {
    console.error('Could not create user: ' + err.message);
  } else {
    console.log('Admin user "' + username + '" created successfully!');
  }
  process.exit(err ? 1 : 0);
});
