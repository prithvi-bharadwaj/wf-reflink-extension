// Detects Wispr Flow transcription vs a normal user copy.
// Key signal: the text contains our trigger phrase ("inserted link", "embedded link", etc.)

const TRIGGER = /(?:inserted|embedded|insert|embed)\s+(?:link|image)/i;
const URL_ONLY_PATTERN = /^https?:\/\/\S+$/;
const PATH_PATTERN = /^(\/|~|[A-Z]:\\)/;

class TranscriptionDetector {
  check(content, queue) {
    if (content.type !== 'text') return null;
    if (queue.size() === 0) return null;

    const { text } = content;
    if (!text || text.trim().length < 10) return null;
    if (URL_ONLY_PATTERN.test(text.trim())) return null;
    if (PATH_PATTERN.test(text.trim())) return null;

    // Must contain at least one trigger phrase
    if (!TRIGGER.test(text)) return null;

    return { text };
  }
}

module.exports = { TranscriptionDetector };
