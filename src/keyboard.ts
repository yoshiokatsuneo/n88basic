// The queue is for INKEY$, while held keys are for KEYDOWN().
// Separate input sources let touch and physical keys coexist.
export class Keyboard {
  queue: string[] = [];
  held = new Map<string, string>();
  characters = new Map<string, string>();
  constructor() {
    this.clear();
  }
  normalize(key: string) {
    const k = key.toUpperCase();
    return (
      (
        {
          ARROWLEFT: "LEFT",
          ARROWRIGHT: "RIGHT",
          ARROWUP: "UP",
          ARROWDOWN: "DOWN",
          " ": "SPACE",
          RETURN: "ENTER",
        } as Record<string, string>
      )[k] || k
    );
  }
  press(key: string, source = key, repeat = false) {
    if (this.held.has(source) && !repeat) {
      return;
    }
    this.held.set(source, this.normalize(key));
    const code: Record<string, number> = {
      LEFT: 29,
      RIGHT: 28,
      UP: 30,
      DOWN: 31,
      ENTER: 13,
      SPACE: 32,
      BACKSPACE: 8,
      DELETE: 127,
    };
    const normalized = this.normalize(key);
    const value =
      code[normalized] !== undefined
        ? String.fromCharCode(code[normalized])
        : key.length === 1
          ? key
          : "";
    if (value) {
      this.characters.set(source, value);
    }
    if (value) {
      if (this.queue.length === 64) {
        this.queue.shift();
      }
      this.queue.push(value);
    }
  }
  release(source: string) {
    this.held.delete(source);
    this.characters.delete(source);
  }
  read(continuous = false) {
    return (
      this.queue.shift() ??
      (continuous ? ([...this.characters.values()].at(-1) ?? "") : "")
    );
  }
  isDown(key: string) {
    return [...this.held.values()].includes(this.normalize(key));
  }
  clear() {
    this.queue = [];
    this.held = new Map();
    this.characters = new Map();
  }
}
