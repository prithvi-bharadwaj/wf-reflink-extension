const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { ReferenceReplacer } = require('../src/reference-replacer');

const TRIGGERS = ['inserted link', 'embedded image'];

const textRef = (text) => ({ type: 'text', text });
const imgRef  = (imageData = 'data:image/png;base64,AAA') => ({ type: 'image', imageData });

describe('ReferenceReplacer.parse', () => {
  test('returns the whole text as a single text segment when no refs', () => {
    const r = new ReferenceReplacer(TRIGGERS);
    const out = r.parse('Hello inserted link world', []);
    assert.equal(out.count, 0);
    assert.deepEqual(out.segments, [{ type: 'text', content: 'Hello inserted link world' }]);
  });

  test('returns the whole text unchanged when triggers are empty', () => {
    const r = new ReferenceReplacer([]);
    const out = r.parse('Hello inserted link world', [textRef('x')]);
    assert.equal(out.count, 0);
    assert.deepEqual(out.segments, [{ type: 'text', content: 'Hello inserted link world' }]);
  });

  test('splits around a single trigger and consumes one ref', () => {
    const r = new ReferenceReplacer(TRIGGERS);
    const out = r.parse('see inserted link now', [textRef('https://example.com')]);
    assert.equal(out.count, 1);
    assert.deepEqual(out.segments, [
      { type: 'text', content: 'see ' },
      { type: 'ref', ref: { type: 'text', text: 'https://example.com' } },
      { type: 'text', content: ' now' },
    ]);
  });

  test('consumes refs in order across multiple triggers', () => {
    const r = new ReferenceReplacer(TRIGGERS);
    const out = r.parse(
      'inserted link then embedded image',
      [textRef('URL1'), imgRef('IMG1')]
    );
    assert.equal(out.count, 2);
    assert.equal(out.segments[0].type, 'ref');
    assert.equal(out.segments[0].ref.text, 'URL1');
    assert.equal(out.segments[2].type, 'ref');
    assert.equal(out.segments[2].ref.type, 'image');
  });

  test('when triggers outnumber refs, extras stay as literal text', () => {
    const r = new ReferenceReplacer(TRIGGERS);
    const out = r.parse(
      'inserted link A inserted link B',
      [textRef('ONE')]
    );
    assert.equal(out.count, 1);
    // first trigger consumed the ref, second stayed as its literal phrase
    // so the user sees it wasn't replaced
    assert.deepEqual(out.segments.map((s) => s.type), ['ref', 'text', 'text', 'text']);
    assert.equal(out.segments[0].ref.text, 'ONE');
    assert.equal(out.segments[1].content, ' A ');
    assert.equal(out.segments[2].content, 'inserted link');
    assert.equal(out.segments[3].content, ' B');
  });

  test('is case-insensitive on the trigger phrase', () => {
    const r = new ReferenceReplacer(TRIGGERS);
    const out = r.parse('INSERTED LINK here', [textRef('url')]);
    assert.equal(out.count, 1);
    assert.equal(out.segments[0].type, 'ref');
  });

  test('does not leak regex lastIndex across parse calls', () => {
    const r = new ReferenceReplacer(TRIGGERS);
    const refs = [textRef('A')];
    r.parse('inserted link one', refs);
    const out = r.parse('inserted link two', refs);
    assert.equal(out.count, 1, 'second parse must also match from index 0');
  });
});

describe('ReferenceReplacer.flattenForBatch', () => {
  test('inlines text refs and strips image triggers', () => {
    const r = new ReferenceReplacer(TRIGGERS);
    const segments = [
      { type: 'text', content: 'Link: ' },
      { type: 'ref',  ref: textRef('https://example.com') },
      { type: 'text', content: ' and image: ' },
      { type: 'ref',  ref: imgRef('data:image/png;base64,ZZZ') },
    ];
    const { text, images } = r.flattenForBatch(segments);
    assert.equal(text, 'Link: https://example.com and image:');
    assert.equal(images.length, 1);
    assert.equal(images[0].type, 'image');
  });

  test('collapses whitespace and fixes stranded punctuation', () => {
    const r = new ReferenceReplacer(TRIGGERS);
    const segments = [
      { type: 'text', content: 'Check ' },
      { type: 'ref',  ref: imgRef() },
      { type: 'text', content: ' , and done.' },
    ];
    const { text } = r.flattenForBatch(segments);
    assert.equal(text, 'Check, and done.');
  });

  test('drops leading punctuation/whitespace', () => {
    const r = new ReferenceReplacer(TRIGGERS);
    const segments = [
      { type: 'text', content: ' , ' },
      { type: 'ref',  ref: textRef('A') },
    ];
    const { text } = r.flattenForBatch(segments);
    assert.equal(text, 'A');
  });

  test('returns empty images list when only text refs', () => {
    const r = new ReferenceReplacer(TRIGGERS);
    const { images } = r.flattenForBatch([
      { type: 'text', content: 'a ' },
      { type: 'ref',  ref: textRef('b') },
    ]);
    assert.deepEqual(images, []);
  });
});
