'use strict';

// NOTE: these tests only check the arithmetic in computePortraitHeight in
// isolation. They do NOT prove the real page doesn't scroll — that depends on
// actual rendered CSS/layout (other elements on the page, margins, the real
// reservedBelow value measured from the DOM, etc.), none of which exists here.
// A previous version of this fix passed tests just like these while the
// Next/Share buttons still ran off the bottom of the real page, because the
// caller wasn't passing a reservedBelow at all. The real regression guard is
// the manual "no scrollbar after clicking Get Weird" check in CLAUDE.md,
// checked live at a couple of viewport heights and both nav states — do that
// after any change here, don't rely on these tests alone.
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

  it('reserves room for controls (Next/Share buttons) rendered below the player', function () {
    // Regression: the player used to fill *all* remaining space down to the
    // viewport edge, pushing the Next/Share buttons below it off-screen.
    var viewportHeight = 860;
    var containerTop = 184;
    var reservedBelow = 90; // Next/Share button row
    var height = computePortraitHeight(viewportHeight, containerTop, reservedBelow);
    assert.ok(
      containerTop + height + reservedBelow <= viewportHeight,
      'player + reserved controls below it must both stay within the viewport'
    );
  });

  it('shrinks further as the reserved control area grows', function () {
    var noControls = computePortraitHeight(860, 184, 0);
    var withControls = computePortraitHeight(860, 184, 90);
    assert.ok(withControls < noControls, 'reserving space for controls must reduce the player height');
    assert.strictEqual(noControls - withControls, 90);
  });
});
