'use strict';

var assert = require('assert');
var api = require('../controllers/api');
var admin = require('../controllers/admin');

function makeRes() {
  var res = {};
  res.status = function (c) { res._status = c; return res; };
  res.json = function (b) { res._body = b; return res; };
  res.redirect = function (url) { res._redirect = url; return res; };
  res.render = function (view, data) { res._view = view; res._data = data; return res; };
  return res;
}

// ─── needsAdmin (the auth guard) ──────────────────────────────────────────────

describe('admin.needsAdmin', function () {
  it('calls next() for an admin user', function (done) {
    var req = { user: { username: 'jakem', admin: true } };
    admin.needsAdmin(req, makeRes(), function () { done(); });
  });

  it('redirects a logged-in non-admin to /login', function () {
    var req = { user: { username: 'bob', admin: false } };
    var res = makeRes();
    var nextCalled = false;
    admin.needsAdmin(req, res, function () { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res._redirect, '/login');
  });

  it('redirects an anonymous visitor to /login', function () {
    var req = { user: null };
    var res = makeRes();
    var nextCalled = false;
    admin.needsAdmin(req, res, function () { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res._redirect, '/login');
  });

  it('does not treat a truthy non-true admin value as admin', function () {
    var req = { user: { username: 'x', admin: 'yes' } };
    var res = makeRes();
    var nextCalled = false;
    admin.needsAdmin(req, res, function () { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res._redirect, '/login');
  });
});

// ─── admin index render ───────────────────────────────────────────────────────

describe('admin.getIndex', function () {
  it('renders admin/index with the user and a csrf token', function () {
    var req = { user: { username: 'jakem', admin: true }, csrfToken: function () { return 'tok123'; } };
    var res = makeRes();
    admin.getIndex(req, res);
    assert.strictEqual(res._view, 'admin/index');
    assert.strictEqual(res._data.user.username, 'jakem');
    assert.strictEqual(res._data.csrfToken, 'tok123');
  });
});

// ─── admin write paths (Mongoose rewrite in Phase 3 must keep these working) ──

describe('admin.postSubmitVid', function () {
  var orig;
  beforeEach(function () { orig = api.addVideo; });
  afterEach(function () { api.addVideo = orig; });

  it('passes the submitted videoID to api.addVideo and redirects on success', function (done) {
    api.addVideo = function (videoID, cb) {
      assert.strictEqual(videoID, 'dQw4w9WgXcQ');
      cb(null, { videoID: videoID });
    };
    var req = { body: { videoID: 'dQw4w9WgXcQ' } };
    var res = makeRes();
    res.redirect = function (url) { assert.strictEqual(url, '/admin'); done(); };
    admin.postSubmitVid(req, res);
  });

  it('does not redirect when addVideo errors', function () {
    api.addVideo = function (videoID, cb) { cb(new Error('nope')); };
    var req = { body: { videoID: 'x' } };
    var res = makeRes();
    admin.postSubmitVid(req, res);
    assert.strictEqual(res._redirect, undefined);
  });
});

describe('admin.postRemoveVid', function () {
  var orig;
  beforeEach(function () { orig = api.removeVideo; });
  afterEach(function () { api.removeVideo = orig; });

  it('passes the videoID to api.removeVideo and redirects', function () {
    var called = null;
    api.removeVideo = function (videoID) { called = videoID; };
    var req = { body: { videoID: 'abc12345678' } };
    var res = makeRes();
    admin.postRemoveVid(req, res);
    assert.strictEqual(called, 'abc12345678');
    assert.strictEqual(res._redirect, '/admin');
  });
});

// ─── CSRF middleware shape (Phase 1 swaps csurf -> csrf-csrf) ──────────────────

describe('config/csrf', function () {
  it('exports a request-handler middleware function', function () {
    var csrf = require('../config/csrf');
    assert.strictEqual(typeof csrf, 'function');
    // csurf and csrf-csrf protection middleware are both (req, res, next)
    assert.ok(csrf.length >= 2, 'middleware should accept (req, res, next)');
  });
});
