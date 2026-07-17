'use strict';

var assert = require('assert');
var Video = require('../models/video');
var VideoHistory = require('../models/videohistory');
var AnalyticsEvent = require('../models/analyticsevent');
var api = require('../controllers/api');

// ─── helpers ────────────────────────────────────────────────────────────────

function makeReq(overrides) {
  return Object.assign({ session: {}, user: null, sessionID: 'sess-1', query: {} }, overrides);
}

function makeRes() {
  var res = {};
  res.status = function (code) { res._status = code; return res; };
  res.json   = function (body) { res._body   = body; return res; };
  res.send   = function (body) { res._body   = body; return res; };
  res.end    = function () { return res; };
  return res;
}

// ─── randomVideoID ──────────────────────────────────────────────────────────

describe('randomVideoID', function () {
  var origAggregate;
  var origFBIAU;

  beforeEach(function () {
    origAggregate = Video.aggregate;
    origFBIAU     = Video.findByIdAndUpdate;
    // fire-and-forget view bump — returns a promise so randomVideoID's .catch works
    Video.findByIdAndUpdate = function () { return Promise.resolve(); };
  });

  afterEach(function () {
    Video.aggregate        = origAggregate;
    Video.findByIdAndUpdate = origFBIAU;
  });

  it('returns a video doc when unseen videos exist', function (done) {
    var fakeDoc = { _id: 1, videoID: 'abc123' };
    Video.aggregate = function (_pipeline) { return Promise.resolve([fakeDoc]); };

    api.randomVideoID([], function (err, doc) {
      assert.ifError(err);
      assert.strictEqual(doc.videoID, 'abc123');
      done();
    });
  });

  it('returns null when DB is truly empty (seen list also empty)', function (done) {
    Video.aggregate = function (_pipeline) { return Promise.resolve([]); };

    api.randomVideoID([], function (err, doc) {
      assert.ifError(err);
      assert.strictEqual(doc, null);
      done();
    });
  });

  it('resets and retries when all videos have been seen', function (done) {
    var fakeDoc = { _id: 1, videoID: 'xyz789' };
    var callCount = 0;
    Video.aggregate = function (pipeline) {
      callCount++;
      if (callCount === 1) {
        // First call should exclude the seen video
        assert.deepStrictEqual(pipeline[0].$match.videoID.$nin, ['xyz789']);
        return Promise.resolve([]);
      } else {
        // Second call (after reset) should pass empty exclusion list
        assert.deepStrictEqual(pipeline[0].$match.videoID.$nin, []);
        return Promise.resolve([fakeDoc]);
      }
    };

    api.randomVideoID(['xyz789'], function (err, doc) {
      assert.ifError(err);
      assert.strictEqual(doc.videoID, 'xyz789');
      assert.strictEqual(callCount, 2);
      done();
    });
  });

  it('passes the full seen list to $nin', function (done) {
    var seen = ['v1', 'v2', 'v3'];
    var capturedPipeline;
    Video.aggregate = function (pipeline) {
      capturedPipeline = pipeline;
      return Promise.resolve([{ _id: 4, videoID: 'v4' }]);
    };

    api.randomVideoID(seen, function (err) {
      assert.ifError(err);
      assert.deepStrictEqual(capturedPipeline[0].$match.videoID.$nin, seen);
      done();
    });
  });

  it('propagates aggregate errors to callback', function (done) {
    Video.aggregate = function (_pipeline) { return Promise.reject(new Error('DB went kaboom')); };

    api.randomVideoID([], function (err) {
      assert.ok(err);
      assert.strictEqual(err.message, 'DB went kaboom');
      done();
    });
  });
});

// ─── getRandomVid ───────────────────────────────────────────────────────────

describe('getRandomVid', function () {
  var origRandomVideoID;
  var origHistoryCreate;
  var origAnalyticsCreate;

  beforeEach(function () {
    origRandomVideoID  = api.randomVideoID;
    origHistoryCreate  = VideoHistory.create;
    origAnalyticsCreate = AnalyticsEvent.create;
    VideoHistory.create = function () { return Promise.resolve(); };
    AnalyticsEvent.create = function () { return Promise.resolve(); };
  });

  afterEach(function () {
    api.randomVideoID   = origRandomVideoID;
    VideoHistory.create = origHistoryCreate;
    AnalyticsEvent.create = origAnalyticsCreate;
  });

  it('initialises seenVideos array and adds the returned video to it', function (done) {
    var fakeDoc = { _id: 1, videoID: 'abc123' };
    api.randomVideoID = function (_seen, cb) { cb(null, fakeDoc); };

    var req = makeReq({ session: {} });
    var res = makeRes();
    res.json = function (body) {
      assert.strictEqual(body.vidID, 'abc123');
      assert.deepStrictEqual(req.session.seenVideos, ['abc123']);
      done();
    };
    api.getRandomVid(req, res);
  });

  it('appends to an existing seenVideos list', function (done) {
    var fakeDoc = { _id: 2, videoID: 'vid2' };
    api.randomVideoID = function (_seen, cb) { cb(null, fakeDoc); };

    var req = makeReq({ session: { seenVideos: ['vid1'] } });
    var res = makeRes();
    res.json = function () {
      assert.deepStrictEqual(req.session.seenVideos, ['vid1', 'vid2']);
      done();
    };
    api.getRandomVid(req, res);
  });

  it('passes existing seenVideos to randomVideoID', function (done) {
    var fakeDoc = { _id: 3, videoID: 'vid3' };
    var capturedSeen;
    // Snapshot the array at call time — the same reference gets mutated by the push afterwards
    api.randomVideoID = function (seen, cb) { capturedSeen = seen.slice(); cb(null, fakeDoc); };

    var req = makeReq({ session: { seenVideos: ['vid1', 'vid2'] } });
    var res = makeRes();
    res.json = function () {
      assert.deepStrictEqual(capturedSeen, ['vid1', 'vid2']);
      done();
    };
    api.getRandomVid(req, res);
  });

  it('returns 503 when no videos in DB', function (done) {
    api.randomVideoID = function (_seen, cb) { cb(null, null); };

    var req = makeReq({ session: {} });
    var res = makeRes();
    res.status = function (code) {
      assert.strictEqual(code, 503);
      return { json: function () { done(); } };
    };
    api.getRandomVid(req, res);
  });

  it('returns 500 on aggregate error', function (done) {
    api.randomVideoID = function (_seen, cb) { cb(new Error('boom')); };

    var req = makeReq({ session: {} });
    var res = makeRes();
    res.status = function (code) {
      assert.strictEqual(code, 500);
      return { json: function () { done(); } };
    };
    api.getRandomVid(req, res);
  });

  it('creates a VideoHistory entry for logged-in users', function (done) {
    var fakeDoc = { _id: 1, videoID: 'abc123' };
    api.randomVideoID = function (_seen, cb) { cb(null, fakeDoc); };
    var historyCalled = false;
    VideoHistory.create = function (data) {
      assert.strictEqual(data.username, 'testuser');
      assert.strictEqual(data.videoID, 'abc123');
      assert.strictEqual(data.userAgent, 'Mozilla/5.0 (TestAgent)');
      historyCalled = true;
      return Promise.resolve();
    };

    var req = makeReq({ session: {}, user: { username: 'testuser' }, headers: { 'user-agent': 'Mozilla/5.0 (TestAgent)' } });
    var res = makeRes();
    res.json = function () {
      assert.ok(historyCalled, 'VideoHistory.create was not called');
      done();
    };
    api.getRandomVid(req, res);
  });

  it('does not create VideoHistory for anonymous visitors', function (done) {
    var fakeDoc = { _id: 1, videoID: 'abc123' };
    api.randomVideoID = function (_seen, cb) { cb(null, fakeDoc); };
    var historyCalled = false;
    VideoHistory.create = function () { historyCalled = true; return Promise.resolve(); };

    var req = makeReq({ session: {}, user: null });
    var res = makeRes();
    res.json = function () {
      assert.strictEqual(historyCalled, false);
      done();
    };
    api.getRandomVid(req, res);
  });

  it('logs a video_played analytics event for every video served, regardless of login', function (done) {
    var fakeDoc = { _id: 1, videoID: 'abc123' };
    api.randomVideoID = function (_seen, cb) { cb(null, fakeDoc); };
    var captured;
    AnalyticsEvent.create = function (data) { captured = data; return Promise.resolve(); };

    var req = makeReq({ session: {}, user: null, sessionID: 'sess-42' });
    var res = makeRes();
    res.json = function () {
      assert.strictEqual(captured.sessionID, 'sess-42');
      assert.strictEqual(captured.type, 'video_played');
      assert.strictEqual(captured.videoID, 'abc123');
      done();
    };
    api.getRandomVid(req, res);
  });
});

// ─── trackVideoPlay ─────────────────────────────────────────────────────────

describe('trackVideoPlay', function () {
  var origAnalyticsCreate;

  beforeEach(function () {
    origAnalyticsCreate = AnalyticsEvent.create;
  });

  afterEach(function () {
    AnalyticsEvent.create = origAnalyticsCreate;
  });

  it('logs a video_played event for a valid id and returns 204', function (done) {
    var captured;
    AnalyticsEvent.create = function (data) { captured = data; return Promise.resolve(); };

    var req = makeReq({ params: { videoID: 'dQw4w9WgXcQ' }, sessionID: 'sess-99' });
    var res = makeRes();
    res.status = function (code) {
      assert.strictEqual(code, 204);
      assert.strictEqual(captured.sessionID, 'sess-99');
      assert.strictEqual(captured.type, 'video_played');
      assert.strictEqual(captured.videoID, 'dQw4w9WgXcQ');
      done();
      return res;
    };
    api.trackVideoPlay(req, res);
  });

  it('extracts the id from a full URL, not just a bare id', function (done) {
    var captured;
    AnalyticsEvent.create = function (data) { captured = data; return Promise.resolve(); };

    var req = makeReq({ params: { videoID: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });
    var res = makeRes();
    res.status = function (code) {
      assert.strictEqual(code, 204);
      assert.strictEqual(captured.videoID, 'dQw4w9WgXcQ');
      done();
      return res;
    };
    api.trackVideoPlay(req, res);
  });

  it('does not log anything for an unparseable id, but still returns 204', function (done) {
    var called = false;
    AnalyticsEvent.create = function () { called = true; return Promise.resolve(); };

    var req = makeReq({ params: { videoID: 'not a video id' } });
    var res = makeRes();
    res.status = function (code) {
      assert.strictEqual(code, 204);
      assert.strictEqual(called, false);
      done();
      return res;
    };
    api.trackVideoPlay(req, res);
  });
});
