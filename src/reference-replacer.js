// Replaces "inserted link" keyword in transcription with queued clipboard items in order.
// Only this exact phrase triggers replacement -- everything else stays untouched.

const TRIGGER = /(?:inserted|embedded|insert|embed)\s+(?:link|image)/gi;

class ReferenceReplacer {
  process(text, refs) {
    if (!refs.length) return { text, changed: false, count: 0, images: [] };

    let refIndex = 0;
    let count = 0;
    const images = [];

    const result = text.replace(TRIGGER, () => {
      if (refIndex >= refs.length) return 'inserted link';
      const ref = refs[refIndex++];
      count++;
      if (ref.type === 'image') {
        images.push(ref);
        return ''; // removed -- image pasted at cursor after text lands
      }
      return ref.text?.trim() || 'inserted link';
    });

    return { text: result.replace(/ {2,}/g, ' ').trim(), changed: count > 0, count, images };
  }
}

module.exports = { ReferenceReplacer };
