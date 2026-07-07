'use strict';

var assert = require('assert');
var extractVideoId = require('../lib/youtube').extractVideoId;

describe('extractVideoId', function () {
  it('extracts the id from a Shorts URL', function () {
    assert.strictEqual(extractVideoId('https://www.youtube.com/shorts/abcdefghijk'), 'abcdefghijk');
  });

  it('extracts from a standard watch URL', function () {
    assert.strictEqual(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('extracts from a watch URL with extra params before v=', function () {
    assert.strictEqual(extractVideoId('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=5'), 'dQw4w9WgXcQ');
  });

  it('extracts from a youtu.be short link', function () {
    assert.strictEqual(extractVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('extracts from an embed URL', function () {
    assert.strictEqual(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('accepts a bare 11-char id', function () {
    assert.strictEqual(extractVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('rejects non-YouTube URLs, junk, empty, and non-strings', function () {
    assert.strictEqual(extractVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
    assert.strictEqual(extractVideoId('not a link'), null);
    assert.strictEqual(extractVideoId(''), null);
    assert.strictEqual(extractVideoId(null), null);
    assert.strictEqual(extractVideoId({ $gt: '' }), null);
  });
});
