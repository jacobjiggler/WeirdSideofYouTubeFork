'use strict';

var assert = require('assert');
var shouldTrack = require('../lib/analyticsGate').shouldTrack;

describe('shouldTrack', function () {
  it('returns true for a normal request', function () {
    var req = { query: {}, session: {} };
    assert.strictEqual(shouldTrack(req), true);
  });

  it('opts the session out when ?notrack=1 is present', function () {
    var req = { query: { notrack: '1' }, session: {} };
    assert.strictEqual(shouldTrack(req), false);
    assert.strictEqual(req.session.notrack, true);
  });

  it('keeps the session opted out on later requests without the query param', function () {
    var req = { query: {}, session: { notrack: true } };
    assert.strictEqual(shouldTrack(req), false);
  });

  it('ignores other values for notrack', function () {
    var req = { query: { notrack: 'yes' }, session: {} };
    assert.strictEqual(shouldTrack(req), true);
    assert.strictEqual(req.session.notrack, undefined);
  });
});
