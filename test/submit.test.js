'use strict';

var assert = require('assert');
var submit = require('../controllers/submit');
var parse = submit.parseSubmission;

describe('parseSubmission', function () {
  it('parses a standard watch URL as a video', function () {
    var r = parse('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.deepStrictEqual(r && { type: r.type, id: r.sourceId }, { type: 'video', id: 'dQw4w9WgXcQ' });
  });

  it('parses a youtu.be short link as a video', function () {
    var r = parse('https://youtu.be/dQw4w9WgXcQ');
    assert.strictEqual(r.type, 'video');
    assert.strictEqual(r.sourceId, 'dQw4w9WgXcQ');
  });

  it('parses a /shorts/ link as a video', function () {
    var r = parse('https://www.youtube.com/shorts/abcdefghijk');
    assert.strictEqual(r.type, 'video');
    assert.strictEqual(r.sourceId, 'abcdefghijk');
  });

  it('parses a bare 11-char id as a video', function () {
    var r = parse('dQw4w9WgXcQ');
    assert.strictEqual(r.type, 'video');
    assert.strictEqual(r.sourceId, 'dQw4w9WgXcQ');
  });

  it('parses a /playlist?list= URL as a playlist', function () {
    var r = parse('https://www.youtube.com/playlist?list=PLabcdef12345');
    assert.strictEqual(r.type, 'playlist');
    assert.strictEqual(r.sourceId, 'PLabcdef12345');
  });

  it('parses a bare PL... id as a playlist', function () {
    var r = parse('PLabcdefghij0123456789');
    assert.strictEqual(r.type, 'playlist');
  });

  it('treats a watch URL with both v= and list= as a single video', function () {
    var r = parse('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdef12345');
    assert.strictEqual(r.type, 'video');
    assert.strictEqual(r.sourceId, 'dQw4w9WgXcQ');
  });

  it('rejects non-YouTube URLs', function () {
    assert.strictEqual(parse('https://example.com/watch?v=dQw4w9WgXcQ'), null);
    assert.strictEqual(parse('https://vimeo.com/12345'), null);
  });

  it('rejects empty, junk, and over-long input', function () {
    assert.strictEqual(parse(''), null);
    assert.strictEqual(parse('not a link'), null);
    assert.strictEqual(parse(null), null);
    assert.strictEqual(parse('x'.repeat(600)), null);
  });

  it('does not throw on object input (coercion safety)', function () {
    assert.strictEqual(parse({ $gt: '' }), null);
  });
});
