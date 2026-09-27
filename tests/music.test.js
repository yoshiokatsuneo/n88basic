import { test } from "node:test";
import assert from "node:assert/strict";
import { Basic } from "../dist/basic.js";
import { parseMusic, playMusic } from "../dist/music.js";

test("MML pitch, lengths, rests, accidentals, octave shifts and volume", () => {
  const notes = parseMusic("t120 o4 l8 A R4 C# C+ D- >C <C V0 A");
  assert.equal(notes[0].frequency, 440);
  assert.equal(notes[0].seconds, 0.25);
  assert.equal(notes[1].frequency, null);
  assert.equal(notes[1].seconds, 0.5);
  assert.equal(notes[2].frequency, notes[3].frequency);
  assert.equal(notes[2].frequency, notes[4].frequency);
  assert.equal(notes[5].frequency, notes[6].frequency * 2);
  assert.equal(notes[7].volume, 0);
  assert.equal(parseMusic("T120 C4..")[0].seconds, 0.875);
});
test("invalid or unsupported MML is rejected before playing", () => {
  for (const score of [
    "T0 C",
    "O9 C",
    "L0 C",
    "V16 C",
    "O1<C",
    "C0",
    "@1C",
    "MB C",
    "Q8C",
    "X",
    "T",
    "C".repeat(4097),
  ]) {
    assert.throws(() => parseMusic(score), /PLAY/);
  }
});
test("PLAY accepts string expressions and awaits playback before continuing", async () => {
  let release;
  let captured;
  const output = [];
  const basic = new Basic({
    print: (text) => output.push(text),
    play: (notes) => {
      captured = notes;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  basic.assign("M$", "O4A");
  const run = basic.immediate('PLAY M$+"R8":PRINT "DONE"');
  assert.equal(captured[0].frequency, 440);
  assert.equal(output.length, 0);
  release();
  await run;
  assert.equal(output.join(""), "DONE\n");
  for (const command of ["PLAY 123", 'PLAY "C","E"', 'PLAY "@1C"']) {
    await assert.rejects(basic.immediate(command), /PLAY/);
  }
});
test("Ctrl-C aborts playback and skips following statements", async () => {
  let signal;
  const basic = new Basic({
    play: (_notes, abortSignal) => {
      signal = abortSignal;
      return new Promise((resolve) =>
        abortSignal.addEventListener("abort", resolve, { once: true }),
      );
    },
  });
  const run = basic.immediate('PLAY "C1":A=99');
  basic.stop();
  assert.equal(signal.aborted, true);
  assert.equal((await run).stopped, true);
  assert.equal(basic.get("A"), 0);
});
function audioFixture(resume = () => Promise.resolve()) {
  const voices = [];
  const context = {
    currentTime: 0,
    destination: {},
    resume,
    createOscillator() {
      const voice = {
        frequency: {},
        connect() {},
        start(time) {
          this.startTime = time;
        },
        stop() {
          this.stopped = true;
        },
        disconnect() {
          this.disconnected = true;
        },
      };
      voices.push(voice);
      return voice;
    },
    createGain() {
      return {
        gain: { setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    },
  };
  return { context, voices };
}
test("audio abort disconnects scheduled notes and settles playback", async () => {
  const { context, voices } = audioFixture();
  const abort = new AbortController();
  const done = playMusic(context, parseMusic("C1R4E1"), abort.signal);
  await Promise.resolve();
  assert.equal(voices.length, 2);
  assert.equal(voices[1].startTime, 2.51);
  abort.abort();
  await done;
  assert.ok(voices.every((voice) => voice.stopped && voice.disconnected));
});
test("abort while audio permission is pending never schedules delayed sound", async () => {
  let resume;
  const { context, voices } = audioFixture(
    () =>
      new Promise((resolve) => {
        resume = resolve;
      }),
  );
  const abort = new AbortController();
  const done = playMusic(context, parseMusic("C"), abort.signal);
  abort.abort();
  await done;
  resume();
  await Promise.resolve();
  assert.equal(voices.length, 0);
});
