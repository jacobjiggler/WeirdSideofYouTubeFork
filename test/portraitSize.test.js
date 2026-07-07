'use strict';

var assert = require('assert');
var computePortraitHeight = require('../lib/portraitSize').computePortraitHeight;

describe('computePortraitHeight', function () {
  it('fills the space left below the player on a tall viewport', function () {
    // 860 viewport, player starts at y=184 (short navbar) -> 860-184-16
    assert.strictEqual(computePortraitHeight(860, 184), 660);
  });

  it('shrinks when the navbar pushes the player further down', function () {
    // Same viewport, taller admin navbar pushes the player to y=300
    var shortNav = computePortraitHeight(860, 184);
    var tallNav = computePortraitHeight(860, 300);
    assert.ok(tallNav < shortNav, 'a taller navbar must produce a shorter player, not overflow the page');
  });

  it('never sizes the player past the bottom of the viewport', function () {
    var viewportHeight = 860;
    var containerTop = 300;
    var height = computePortraitHeight(viewportHeight, containerTop);
    assert.ok(containerTop + height <= viewportHeight, 'player bottom must stay within the viewport');
  });

  it('floors at a sane minimum on very short or cramped viewports', function () {
    assert.strictEqual(computePortraitHeight(400, 350), 200);
    assert.strictEqual(computePortraitHeight(300, 500), 200);
  });
});
