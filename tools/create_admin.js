#!/bin/env node
var readline = require('readline');
var mongoose = require('mongoose');
var Account = require('../models/account');

var database = require('../config/db');
mongoose.connect(database.url);

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Admin username: ', function(username) {
  rl.question('Password: ', function(password) {
    Account.register(new Account({ username : username, admin: true }), password, function(err, _account) {
      if (err) {
        console.error('Could not create user in database!');
      } else {
        console.info('User created successfully!');
      }

      rl.close();
      process.stdin.destroy();
      process.exit(0);
    });
  });
});
