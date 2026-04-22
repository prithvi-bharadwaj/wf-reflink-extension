const MAX_AGE_MS = 30_000; // only use refs copied in the last 30s

class ReferenceQueue {
  constructor() {
    this.items = [];
  }

  push(content) {
    this.items.push({ ...content, timestamp: Date.now() });
  }

  getAll() {
    const cutoff = Date.now() - MAX_AGE_MS;
    return this.items.filter((r) => r.timestamp >= cutoff);
  }

  size() {
    return this.getAll().length;
  }

  clear() {
    this.items = [];
  }
}

module.exports = { ReferenceQueue };
