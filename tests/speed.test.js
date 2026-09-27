import { test } from "node:test";
import assert from "node:assert/strict";
import { Basic } from "../dist/basic.js";
async function measured(speed) {
  let time = 0;
  const b = new Basic({ speed: () => speed, now: () => time });
  b.sleep = async (ms) => {
    time += ms;
  };
  await b.run("10 FOR I=1 TO 200\n20 A=A+1\n30 NEXT I");
  return { time, value: b.get("A") };
}
test("speed multipliers change scheduled duration without changing results", async () => {
  const slow = await measured(0.5),
    normal = await measured(1),
    fast = await measured(2),
    unlimited = await measured(0);
  for (const r of [slow, normal, fast, unlimited]) assert.equal(r.value, 200);
  assert.ok(slow.time > normal.time * 1.9);
  assert.ok(normal.time > fast.time * 1.9);
  assert.equal(unlimited.time, 0);
});
test("changing to unlimited clears pacing debt; idle time is not saved as credit", async () => {
  let speed = 1,
    time = 0;
  const b = new Basic({ speed: () => speed, now: () => time });
  b.sleep = async (ms) => {
    time += ms;
  };
  for (let i = 0; i < 10; i++) b.pace("A=1");
  time += 10000;
  b.pace("A=1");
  assert.equal(b.paceDebt, 1);
  speed = 0;
  b.pace("A=1");
  assert.equal(b.paceDebt, 0);
});
test("Ctrl+C cancels a pending pacing wait promptly", async () => {
  const b = new Basic({ speed: () => 0.25 });
  const run = b.run("10 GOTO 10");
  setTimeout(() => b.stop(), 5);
  const result = await run;
  assert.equal(result.stopped, true);
  assert.equal(b.executing, false);
});
test("SLEEP retains milliseconds at every selected speed", async () => {
  for (const speed of [0.25, 1, 4, 0]) {
    let time = 0;
    const waits = [];
    const b = new Basic({ speed: () => speed, now: () => time });
    b.sleep = async (ms) => {
      waits.push(ms);
      time += ms;
    };
    await b.immediate("SLEEP 100", "");
    assert.ok(waits.includes(100));
  }
});
