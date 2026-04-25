const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { TranscriptionDetector } = require('../src/transcription-detector');
const { ReferenceQueue } = require('../src/reference-queue');

const TRIGGERS = ['inserted link', 'embedded image'];

function queueWith(n) {
  const q = new ReferenceQueue();
  for (let i = 0; i < n; i++) q.push({ type: 'text', text: `item${i}` });
  return q;
}

describe('TranscriptionDetector.check', () => {
  test('returns null for non-text content', () => {
    const d = new TranscriptionDetector(TRIGGERS);
    const result = d.check({ type: 'image', imageData: 'data:...' }, queueWith(1));
    assert.equal(result, null);
  });

  test('returns null when queue is empty (safety guard)', () => {
    const d = new TranscriptionDetector(TRIGGERS);
    const result = d.check({ type: 'text', text: 'please use inserted link' }, queueWith(0));
    assert.equal(result, null, 'no refs to inject -> not a transcription to rewrite');
  });

  test('returns null when no trigger phrase is present', () => {
    const d = new TranscriptionDetector(TRIGGERS);
    const result = d.check({ type: 'text', text: 'just a regular copy' }, queueWith(1));
    assert.equal(result, null);
  });

  test('returns matched text when a trigger phrase is present', () => {
    const d = new TranscriptionDetector(TRIGGERS);
    const result = d.check(
      { type: 'text', text: 'Check out inserted link below' },
      queueWith(1)
    );
    assert.deepEqual(result, { text: 'Check out inserted link below' });
  });

  test('ignores bare URLs even if they happen to contain trigger substrings', () => {
    const d = new TranscriptionDetector(TRIGGERS);
    const result = d.check(
      { type: 'text', text: 'https://example.com/inserted-link' },
      queueWith(1)
    );
    assert.equal(result, null, 'a user copying a URL is never a transcription');
  });

  test('ignores file paths', () => {
    const d = new TranscriptionDetector(TRIGGERS);
    assert.equal(
      d.check({ type: 'text', text: '/Users/me/Downloads/inserted link.txt' }, queueWith(1)),
      null
    );
    assert.equal(
      d.check({ type: 'text', text: '~/notes/inserted link' }, queueWith(1)),
      null
    );
  });

  test('returns null when triggers list is empty', () => {
    const d = new TranscriptionDetector([]);
    assert.equal(
      d.check({ type: 'text', text: 'inserted link' }, queueWith(1)),
      null
    );
  });

  test('setTriggers updates the regex at runtime', () => {
    const d = new TranscriptionDetector(['attach doc']);
    assert.equal(d.check({ type: 'text', text: 'inserted link here' }, queueWith(1)), null);
    d.setTriggers(['inserted link']);
    assert.ok(d.check({ type: 'text', text: 'inserted link here' }, queueWith(1)));
  });
});
