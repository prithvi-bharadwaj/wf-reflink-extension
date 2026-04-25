const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { ReferenceQueue } = require('../src/reference-queue');

describe('ReferenceQueue', () => {
  test('starts empty', () => {
    const q = new ReferenceQueue();
    assert.equal(q.size(), 0);
    assert.deepEqual(q.getAll(), []);
  });

  test('push stores the content plus a timestamp', () => {
    const q = new ReferenceQueue();
    q.push({ type: 'text', text: 'https://example.com', imageData: '' });
    const items = q.getAll();
    assert.equal(items.length, 1);
    assert.equal(items[0].type, 'text');
    assert.equal(items[0].text, 'https://example.com');
    assert.equal(typeof items[0].timestamp, 'number');
  });

  test('preserves insertion order', () => {
    const q = new ReferenceQueue();
    q.push({ type: 'text', text: 'first' });
    q.push({ type: 'image', imageData: 'data:image/png;base64,iVBOR...' });
    q.push({ type: 'text', text: 'third' });
    const items = q.getAll();
    assert.equal(items[0].text, 'first');
    assert.equal(items[1].type, 'image');
    assert.equal(items[2].text, 'third');
  });

  test('getAll returns a copy, not the internal array', () => {
    const q = new ReferenceQueue();
    q.push({ type: 'text', text: 'a' });
    const snap = q.getAll();
    snap.push({ type: 'text', text: 'mutation' });
    assert.equal(q.size(), 1, 'external mutation must not leak into the queue');
  });

  test('clear empties the queue', () => {
    const q = new ReferenceQueue();
    q.push({ type: 'text', text: 'a' });
    q.push({ type: 'text', text: 'b' });
    q.clear();
    assert.equal(q.size(), 0);
    assert.deepEqual(q.getAll(), []);
  });
});
