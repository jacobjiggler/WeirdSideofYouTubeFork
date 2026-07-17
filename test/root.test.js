'use strict';

var assert = require('assert');
var api = require('../controllers/api');
var AnalyticsEvent = require('../models/analyticsevent');
var root = require('../controllers/root');

function makeReq(overrides) {
  return Object.assign({ session: {}, user: null, sessionID: 'sess-1', query: {} }, overrides);
}

function makeRes() {
  var res = {};
  res.status = function (code) { res._status = code; return res; };
  res.send   = function (body) { res._body   = body; return res; };
  res.render = function (view, locals) { res._view = view; res._locals = locals; return res; };
  return res;
}

describe('getIndex', function () {
  var origRandomVideoID;
  var origAnalyticsCreate;

  beforeEach(function () {
    origRandomVideoID = api.randomVideoID;
    origAnalyticsCreate = AnalyticsEvent.create;
    api.randomVideoID = function (_seen, cb) { cb(null, { _id: 1, videoID: 'abc123' }); };
  });

  afterEach(function () {
    api.randomVideoID = origRandomVideoID;
    AnalyticsEvent.create = origAnalyticsCreate;
  });

  it('logs a page_view analytics event on every landing', function (done) {
    var captured;
    AnalyticsEvent.create = function (data) { captured = data; return Promise.resolve(); };

    var req = makeReq({ sessionID: 'sess-landing' });
    var res = makeRes();
    res.render = function () {
      assert.strictEqual(captured.sessionID, 'sess-landing');
      assert.strictEqual(captured.type, 'page_view');
      done();
      return res;
    };
    root.getIndex(req, res);
  });

  it('still renders the page even if analytics logging fails', function (done) {
    AnalyticsEvent.create = function () { return Promise.reject(new Error('db down')); };

    var req = makeReq({});
    var res = makeRes();
    res.render = function (view) {
      assert.strictEqual(view, 'index');
      done();
      return res;
    };
    root.getIndex(req, res);
  });
});
