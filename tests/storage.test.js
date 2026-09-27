import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrograms, readPrograms, writePrograms } from "../dist/storage.js";
import { Basic } from "../dist/basic.js";
import { Session } from "../dist/session.js";

test("saved programs accept Unicode names and preserve special property names", () => {
  const programs = parsePrograms('{"日本語":"10 END","__proto__":"20 END"}');
  assert.equal(programs["日本語"], "10 END");
  assert.equal(Object.getPrototypeOf(programs), Object.prototype);
  assert.equal(Object.hasOwn(programs, "__proto__"), true);
  assert.equal(programs["__proto__"], "20 END");
  assert.deepEqual(parsePrograms(null), {});
});

test("saved programs reject malformed JSON, non-objects and non-string code", () => {
  for (const data of [
    "{",
    "null",
    "[]",
    "123",
    '"text"',
    '{"game":null}',
    '{"game":{}}',
  ]) {
    assert.throws(() => parsePrograms(data), /保存データ/);
  }
});

test("SAVE refuses corrupted storage without overwriting it or the current source", async () => {
  let stored = '{"game":null}';
  let source = "10 PRINT 42";
  const storage = {
    getItem: () => stored,
    setItem: (_key, value) => {
      stored = value;
    },
  };
  const session = new Session(new Basic(), {
    getSource: () => source,
    setSource: (value) => {
      source = value;
    },
    print() {},
    readPrograms: () => readPrograms(storage),
    writePrograms: (programs) => writePrograms(storage, programs),
  });
  for (const command of [
    'SAVE "new"',
    'LOAD "game"',
    'MERGE "game"',
    "FILES",
  ]) {
    await assert.rejects(session.submit(command), /保存データ/);
    assert.equal(stored, '{"game":null}');
    assert.equal(source, "10 PRINT 42");
  }
});
