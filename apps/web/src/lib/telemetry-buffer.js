const DEFAULT_CAPACITY = 2000; // ~100s at 20Hz

export class TelemetryBuffer {
  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.count = 0;
  }

  push(frame) {
    this.buffer[this.head] = frame;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  getLatest() {
    if (this.count === 0) return null;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  getAll() {
    if (this.count === 0) return [];
    const result = new Array(this.count);
    const start = (this.head - this.count + this.capacity) % this.capacity;
    for (let i = 0; i < this.count; i++) {
      result[i] = this.buffer[(start + i) % this.capacity];
    }
    return result;
  }

  getCurrentLapFrames() {
    const latest = this.getLatest();
    if (!latest) return [];
    const currentLap = latest.lap;
    const all = this.getAll();
    const frames = [];
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].lap === currentLap) {
        frames.unshift(all[i]);
      } else {
        break;
      }
    }
    return frames;
  }

  clear() {
    this.head = 0;
    this.count = 0;
  }
}
