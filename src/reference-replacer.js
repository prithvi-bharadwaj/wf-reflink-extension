// Parses a Wispr transcription + queued refs into an ordered list of segments.
// Each trigger phrase becomes a ref segment consuming the next queued clipboard
// item; all surrounding text stays as text segments, preserving spacing.
//
// The paster walks these segments to produce the final paste — either inline
// (segmented mode) or flattened into one text paste + image tail (batch mode).

const TRIGGER = /(?:inserted|embedded|insert|embed)\s+(?:links?|images?)/gi;

class ReferenceReplacer {
  parse(text, refs) {
    if (!refs.length) {
      return { segments: [{ type: 'text', content: text }], count: 0 };
    }

    const segments = [];
    let lastIndex = 0;
    let refIndex = 0;

    const re = new RegExp(TRIGGER.source, TRIGGER.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      if (refIndex < refs.length) {
        segments.push({ type: 'ref', ref: refs[refIndex++] });
      } else {
        // no ref left — keep the original phrase so the user notices
        segments.push({ type: 'text', content: match[0] });
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      segments.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return { segments, count: refIndex };
  }

  // Collapse segments into a single text string (for batch mode's Wispr paste),
  // inlining text refs and stripping image triggers. Returns both the flattened
  // text and the list of image refs to paste afterward.
  flattenForBatch(segments) {
    const images = [];
    const joined = segments.map((seg) => {
      if (seg.type === 'text') return seg.content;
      if (seg.ref.type === 'image') { images.push(seg.ref); return ''; }
      return (seg.ref.text || '').trim();
    }).join('');

    const cleaned = joined
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s.,;:!?]+/, '')
      .trim();

    return { text: cleaned, images };
  }
}

module.exports = { ReferenceReplacer };
