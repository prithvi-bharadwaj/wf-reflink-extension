// Detects whether a clipboard change is a Wispr Flow transcription that
// should be rewritten with queued refs, or just a regular user copy.

const { buildDetectorRegex } = require('./triggers-regex');

const URL_ONLY_PATTERN = /^https?:\/\/\S+$/;
const PATH_PATTERN = /^(\/|~|[A-Z]:\\)/;

class TranscriptionDetector {
  constructor(triggers = []) {
    this.setTriggers(triggers);
  }

  setTriggers(triggers) {
    this.triggers = triggers;
    this.regex = buildDetectorRegex(triggers);
  }

  check(content, queue) {
    if (content.type !== 'text') return null;
    if (queue.size() === 0) return null;
    if (!this.regex) return null;

    const { text } = content;
    if (!text) return null;
    const trimmed = text.trim();
    if (URL_ONLY_PATTERN.test(trimmed)) return null;
    if (PATH_PATTERN.test(trimmed)) return null;

    if (!this.regex.test(text)) return null;

    return { text };
  }
}

module.exports = { TranscriptionDetector };
