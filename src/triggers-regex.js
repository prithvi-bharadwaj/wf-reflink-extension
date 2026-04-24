// Builds regexes from a list of user-defined trigger phrases.
// Phrases are matched literally (metachars escaped), case-insensitive, and
// bounded by word boundaries so short triggers like "pic" don't match
// "picture".

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildAlternation(phrases) {
  return phrases.map(escapeRegex).join('|');
}

function buildDetectorRegex(phrases) {
  if (!phrases.length) return null;
  return new RegExp(`\\b(?:${buildAlternation(phrases)})\\b`, 'i');
}

function buildReplacerRegex(phrases) {
  if (!phrases.length) return null;
  return new RegExp(`\\b(?:${buildAlternation(phrases)})\\b`, 'gi');
}

module.exports = { buildDetectorRegex, buildReplacerRegex, escapeRegex };
