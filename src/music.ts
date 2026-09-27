import { BasicError } from "./errors.js";

export interface MusicNote {
  readonly frequency: number | null;
  readonly seconds: number;
  readonly volume: number;
}

/** Basic single-voice MML. Settings intentionally reset for each PLAY. */
export function parseMusic(source: string): MusicNote[] {
  if (source.length > 4096) {
    throw new BasicError("PLAYの文字列は4096文字以内で指定してください");
  }
  const text = source.replace(/\s+/g, "").toUpperCase();
  const notes: MusicNote[] = [];
  const pitches: Partial<Record<string, number>> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  let position = 0;
  let tempo = 120;
  let octave = 4;
  let length = 4;
  let volume = 8;
  let total = 0;
  function number(min: number, max: number, fallback?: number): number {
    const digits = text.slice(position).match(/^\d+/)?.[0];
    if (digits === undefined) {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new BasicError("PLAYに数値が必要です");
    }
    position += digits.length;
    const value = Number(digits);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new BasicError(`PLAYの数値は${min}〜${max}で指定してください`);
    }
    return value;
  }
  while (position < text.length) {
    const command = text.charAt(position++);
    if (command === "T") {
      tempo = number(32, 255);
      continue;
    }
    if (command === "O") {
      octave = number(1, 8);
      continue;
    }
    if (command === "L") {
      length = number(1, 64);
      continue;
    }
    if (command === "V") {
      volume = number(0, 15);
      continue;
    }
    if (command === ">" || command === "<") {
      octave += command === ">" ? 1 : -1;
      if (octave < 1 || octave > 8) {
        throw new BasicError("PLAYのオクターブは1〜8です");
      }
      continue;
    }
    const pitch = pitches[command];
    if (pitch === undefined && command !== "R") {
      throw new BasicError(`PLAYの未対応指定: ${command}`);
    }
    let accidental = 0;
    if (command !== "R" && ["#", "+", "-"].includes(text.charAt(position))) {
      accidental = text.charAt(position++) === "-" ? -1 : 1;
    }
    let seconds = 240 / tempo / number(1, 64, length);
    let extra = seconds / 2;
    while (text.charAt(position) === ".") {
      seconds += extra;
      extra /= 2;
      position++;
    }
    total += seconds;
    if (total > 600) {
      throw new BasicError("PLAYは1回10分以内で指定してください");
    }
    notes.push({
      frequency:
        pitch === undefined
          ? null
          : 440 * 2 ** (((octave + 1) * 12 + pitch + accidental - 69) / 12),
      seconds,
      volume: volume / 15,
    });
  }
  return notes;
}

/** Audio-clock scheduling avoids per-note timer drift; abort also settles the wait. */
export function playMusic(
  context: AudioContext,
  notes: readonly MusicNote[],
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted || notes.length === 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const voices: { oscillator: OscillatorNode; gain: GainNode }[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    function finish(error?: unknown): void {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      for (const { oscillator, gain } of voices) {
        oscillator.stop();
        oscillator.disconnect();
        gain.disconnect();
      }
      if (error !== undefined) {
        reject(error);
      } else {
        resolve();
      }
    }
    function abort(): void {
      finish();
    }
    signal.addEventListener("abort", abort, { once: true });
    context
      .resume()
      .then(() => {
        if (finished) {
          return;
        }
        const start = context.currentTime + 0.01;
        let time = start;
        for (const note of notes) {
          if (note.frequency !== null && note.volume > 0) {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = "triangle";
            oscillator.frequency.value = note.frequency;
            const end = time + note.seconds * 0.9;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.12 * note.volume, time + 0.003);
            gain.gain.setValueAtTime(
              0.12 * note.volume,
              Math.max(time + 0.003, end - 0.005),
            );
            gain.gain.linearRampToValueAtTime(0, end);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(time);
            oscillator.stop(time + note.seconds);
            voices.push({ oscillator, gain });
          }
          time += note.seconds;
        }
        timer = setTimeout(
          () => finish(),
          Math.max(0, time - context.currentTime) * 1000,
        );
      })
      .catch(finish);
  });
}
