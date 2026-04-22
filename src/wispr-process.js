const { execFile } = require('child_process');

const CACHE_MS = 1000;
// Match only "Wispr Flow" with a space — keeps us from matching our own dev
// process path ("wisprFlow extension/node_modules/electron/...").
const PROCESS_PATTERNS = [/Wispr Flow/i];

let cachedAt = 0;
let cachedResult = false;

function isRunning() {
  if (Date.now() - cachedAt < CACHE_MS) return Promise.resolve(cachedResult);

  return new Promise((resolve) => {
    execFile('/bin/ps', ['-Ao', 'comm='], (err, stdout) => {
      if (err) { resolve(false); return; }
      const running = PROCESS_PATTERNS.some((re) => re.test(stdout));
      cachedAt = Date.now();
      cachedResult = running;
      resolve(running);
    });
  });
}

module.exports = { isRunning };
