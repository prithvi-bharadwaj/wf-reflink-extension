const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDetectorRegex,
  buildReplacerRegex,
  escapeRegex,
} = require('../src/triggers-regex');

describe('escapeRegex', () => {
  test('escapes regex metachars', () => {
    assert.equal(escapeRegex('a.b'), 'a\\.b');
    assert.equal(escapeRegex('a+b'), 'a\\+b');
    assert.equal(escapeRegex('(hi)'), '\\(hi\\)');
    assert.equal(escapeRegex('hello'), 'hello');
  });
});

describe('buildDetectorRegex', () => {
  test('returns null for empty triggers', () => {
    assert.equal(buildDetectorRegex([]), null);
  });

  test('matches any of the given triggers (case-insensitive)', () => {
    const re = buildDetectorRegex(['inserted link', 'embedded image']);
    assert.ok(re.test('Check out inserted link here'));
    assert.ok(re.test('Check out INSERTED LINK here'));
    assert.ok(re.test('See embedded image below'));
    assert.equal(re.test('no match here'), false);
  });

  test('word boundaries prevent substring matches', () => {
    const re = buildDetectorRegex(['pic']);
    assert.equal(re.test('picture'), false, "'pic' should not match inside 'picture'");
    assert.ok(re.test('grab a pic please'));
  });

  test('escapes trigger phrases containing metachars', () => {
    const re = buildDetectorRegex(['a.b']);
    assert.equal(re.test('aXb'), false, "'.' must be literal");
    assert.ok(re.test('say a.b now'));
  });
});

describe('buildReplacerRegex', () => {
  test('returns null for empty triggers', () => {
    assert.equal(buildReplacerRegex([]), null);
  });

  test('is global + case-insensitive', () => {
    const re = buildReplacerRegex(['inserted link']);
    assert.ok(re.flags.includes('g'));
    assert.ok(re.flags.includes('i'));
  });

  test('finds every occurrence', () => {
    const re = buildReplacerRegex(['inserted link']);
    const matches = 'inserted link and inserted LINK'.match(re);
    assert.equal(matches.length, 2);
  });
});
