import { test } from "node:test";
import assert from "node:assert/strict";
import { Basic } from "../dist/basic.js";
import { Keyboard } from "../dist/keyboard.js";
import { samples } from "../dist/samples.js";

test("INKEY$ consumes the queue without blocking; KEYDOWN tracks held keys", async () => {
  const keys = new Keyboard();
  keys.press("a", "KeyA");
  keys.press("a", "KeyA");
  let output = "";
  const b = new Basic({
    inkey: () => keys.read(),
    keydown: (k) => keys.isDown(k),
    print: (s) => (output += s),
  });
  await b.run('10 PRINT INKEY$;INKEY$\n20 PRINT KEYDOWN("A");KEYDOWN("LEFT")');
  assert.equal(output, "a\n-10\n");
  keys.release("KeyA");
  assert.equal(keys.isDown("A"), false);
});
test("arrow key codes, multiple sources, buffer limit and blur cleanup", () => {
  const k = new Keyboard();
  k.press("ArrowLeft", "physical");
  k.press("ArrowLeft", "touch");
  assert.equal(k.read(), String.fromCharCode(29));
  k.release("physical");
  assert.equal(k.isDown("LEFT"), true);
  k.clear();
  assert.equal(k.isDown("LEFT"), false);
  assert.equal(k.read(), "");
  for (let i = 0; i < 100; i++) k.press("x", String(i));
  assert.equal(k.queue.length, 64);
});
test("SLEEP yields and stop cancels a long delay promptly", async () => {
  let output = "";
  const b = new Basic({ print: (s) => (output += s) });
  const promise = b.run('10 SLEEP 60000\n20 PRINT "BAD"');
  await new Promise((r) => setTimeout(r, 5));
  b.stop();
  assert.deepEqual(await promise, { stopped: true });
  assert.equal(output, "");
  await assert.rejects(b.run("10 SLEEP -1"), /10行.*SLEEP/);
  await assert.rejects(b.run('10 SLEEP "x"'), /10行.*SLEEP/);
});

// Run the actual editable BASIC sample with a deterministic clock and input.
async function game({
  frame = () => {},
  print = () => {},
  keydown = () => false,
  inkey = () => " ",
} = {}) {
  let frames = 0,
    output = "";
  const b = new Basic({
    inkey,
    keydown,
    print: (s) => {
      output += s;
      print(s, b);
    },
  });
  b.sleep = async () => {
    if (++frames > 3000) throw new Error("Game did not reach expected state");
    await frame(b, frames);
  };
  await b.run(samples.breakout);
  return { b, frames, output };
}
test("unattended game loses three lives and reaches GAME OVER", async () => {
  const { b, output } = await game({
    print: (s, b) => {
      if (s === "GAME OVER") b.stop();
    },
  });
  assert.equal(b.get("LIVES"), 0);
  assert.match(output, /GAME OVER/);
  assert.ok(b.get("SCORE") > 0);
});
test("held keys move the paddle and clamp it at both walls", async () => {
  let right = false;
  const { b } = await game({
    keydown: (k) => (right ? k === "RIGHT" : k === "LEFT"),
    frame: (b, n) => {
      // Keep the ball aloft while testing input through the real game loop.
      b.assign("Y", 250);
      b.assign("VY", -5);
      if (n === 40) {
        assert.equal(b.get("PX"), 8);
        right = true;
      }
      if (n === 110) {
        assert.equal(b.get("PX"), 532);
        b.stop();
      }
    },
  });
  assert.equal(b.get("PX"), 532);
});
test("ball bounces on walls and paddle; a brick awards exactly ten points", async () => {
  await game({
    frame: (b, n) => {
      if (n === 1) {
        b.assign("X", 10);
        b.assign("Y", 250);
        b.assign("VX", -3);
      }
      if (n === 2) {
        assert.equal(b.get("X"), 12);
        assert.equal(b.get("VX"), 3);
        b.assign("X", 320);
        b.assign("Y", 341);
        b.assign("VX", 0);
        b.assign("VY", 5);
      }
      if (n === 3) {
        assert.equal(b.get("VY"), -5);
        b.assign("X", 50);
        b.assign("Y", 145);
        b.assign("VY", -5);
      }
      if (n === 4) {
        assert.equal(b.get("SCORE"), 10);
        assert.equal(b.arrayValue("B", [16]), 0);
        assert.equal(b.get("VY"), 5);
        b.stop();
      }
    },
  });
});
test("destroying the last brick reaches CLEAR and SPACE resets score and lives", async () => {
  let cleared = false,
    restarted = false;
  const { output } = await game({
    print: (s, b) => {
      if (s.includes("CLEAR!")) cleared = true;
    },
    frame: (b, n) => {
      if (n === 1) {
        for (let i = 0; i < 24; i++) b.assign("B(" + i + ")", 0);
        b.assign("B(16)", 1);
        b.assign("SCORE", 230);
        b.assign("X", 50);
        b.assign("Y", 145);
        b.assign("VX", 0);
        b.assign("VY", -5);
      }
      if (cleared && b.get("SCORE") === 0) {
        assert.equal(b.get("LIVES"), 3);
        assert.equal(b.arrayValue("B", [16]), 1);
        restarted = true;
        b.stop();
      }
    },
  });
  assert.match(output, /CLEAR!/);
  assert.equal(restarted, true);
});
test("all existing non-interactive samples still execute", async () => {
  for (const name of ["hello", "graphic", "table"])
    await new Basic().run(samples[name]);
});
test("a quick arrow tap moves the paddle even after key release", async () => {
  const keys = new Keyboard();
  let started = false;
  await game({
    inkey: () => (started ? keys.read() : " "),
    keydown: (k) => keys.isDown(k),
    frame: (b, n) => {
      if (n === 1) {
        started = true;
        keys.press("ArrowRight", "tap");
        keys.release("tap");
      }
      if (n === 2) {
        assert.equal(b.get("PX"), 279);
        b.stop();
      }
    },
  });
});
test("INKEY$ includes editing keys and the key-test sample exits on Q", async () => {
  const keys = new Keyboard();
  for (const key of [
    "Backspace",
    "Delete",
    "Enter",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
  ])
    keys.press(key, key);
  assert.deepEqual(
    Array.from({ length: 7 }, () => keys.read().charCodeAt(0)),
    [8, 127, 13, 29, 28, 30, 31],
  );
  let output = "",
    polls = 0;
  const b = new Basic({
    inkey: () => (++polls < 3 ? "" : polls === 3 ? "a" : "Q"),
    print: (s) => (output += s),
  });
  await b.run(samples.inkey);
  assert.match(output, /KEY=\[a\] CODE=97/);
  assert.match(output, /KEY=\[Q\] CODE=81/);
});
test("INKEY$ accepts physical key repeats while preserving held state and buffer limit", () => {
  const k = new Keyboard();
  k.press(" ", "keyboard:Space");
  assert.equal(k.read(), " ");
  assert.equal(k.read(), "");
  k.press(" ", "keyboard:Space", true);
  assert.equal(k.read(), " ");
  assert.equal(k.isDown("SPACE"), true);
  k.press(" ", "keyboard:Space");
  assert.equal(k.read(), "");
  for (let i = 0; i < 100; i++) k.press(" ", "keyboard:Space", true);
  assert.equal(k.queue.length, 64);
  k.release("keyboard:Space");
  assert.equal(k.isDown("SPACE"), false);
  k.clear();
  assert.equal(k.read(), "");
});
test("continuous INKEY$ reads held space before OS repeat starts, and stops on release", () => {
  const k = new Keyboard();
  k.press(" ", "keyboard:Space");
  for (let i = 0; i < 100; i++) assert.equal(k.read(true), " ");
  k.release("keyboard:Space");
  assert.equal(k.read(true), "");
  k.press("a", "KeyA");
  k.read(true);
  k.press("b", "KeyB");
  k.read(true);
  assert.equal(k.read(true), "b");
  k.release("KeyB");
  assert.equal(k.read(true), "a");
  k.clear();
  assert.equal(k.read(true), "");
});
