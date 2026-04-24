// Holds the refs copied during the current COLLECTING phase.
// Session boundaries (start/end) are the lifetime — there is no age cutoff,
// so long dictations don't silently drop their earliest copies.

class ReferenceQueue {
  constructor() {
    this.items = [];
  }

  push(content) {
    this.items.push({ ...content, timestamp: Date.now() });
  }

  getAll() {
    return [...this.items];
  }

  size() {
    return this.items.length;
  }

  clear() {
    this.items = [];
  }
}

module.exports = { ReferenceQueue };
