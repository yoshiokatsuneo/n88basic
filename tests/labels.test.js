import { test } from "node:test";
import assert from "node:assert/strict";
import { Basic } from "../dist/basic.js";
import { Session } from "../dist/session.js";
function setup() {
  let out = "";
  const b = new Basic({ print: (s) => (out += s) });
  return { b, out: () => out };
}
test("labels branch forward and backward, case insensitively, including colon definitions", async () => {
  const { b, out } = setup();
  await b.run(
    '10 *LOOP:A=A+1\n20 IF A<3 THEN *loop ELSE *Done\n30 PRINT "BAD"\n40 *DONE:PRINT A',
  );
  assert.equal(out(), "3\n");
});
test("ON GOSUB mixes numeric and named targets and RETURN works", async () => {
  const { b, out } = setup();
  await b.run(
    '10 ON 2 GOSUB 100,*SUB\n20 PRINT "END":END\n100 RETURN\n200 *SUB:PRINT "SUB":RETURN',
  );
  assert.equal(out(), "SUB\nEND\n");
});
test("immediate GOSUB label returns to immediate command", async () => {
  const { b, out } = setup();
  await b.immediate('GOSUB *SUB:PRINT "BACK"', '100 *SUB:PRINT "SUB":RETURN');
  assert.equal(out(), "SUB\nBACK\n");
});
test("RESTORE label works in program and immediate mode", async () => {
  const { b, out } = setup();
  const source =
    "10 DATA 1\n20 *VALUES:DATA 2,3\n30 RESTORE *VALUES:READ A:PRINT A";
  await b.run(source);
  assert.equal(out(), "2\n");
  await b.immediate("RESTORE *values:READ A", "10 DATA 1\n20 *VALUES:DATA 9");
  assert.equal(b.get("A"), 9);
});
test("duplicate, missing and malformed labels report errors", async () => {
  const { b } = setup();
  await assert.rejects(b.run("10 *A\n20 *a"), /重複/);
  await assert.rejects(b.run("10 GOTO *MISSING"), /10行.*ラベルがありません/);
  await assert.rejects(b.run("10 RESTORE *MISSING"), /ラベルがありません/);
  await assert.rejects(b.run("10 *123"), /Syntax error in 10/);
});
test("RENUM leaves label references intact; RUN accepts a label", async () => {
  const { b, out } = setup();
  let source = '7 GOTO *START\n25 *START:PRINT "OK":END';
  const session = new Session(b, {
    getSource: () => source,
    setSource: (v) => (source = v),
  });
  await session.submit("RENUM 100,,5");
  assert.equal(source, '100 GOTO *START\n105 *START:PRINT "OK":END');
  await session.submit("RUN *start");
  assert.equal(out(), "OK\n");
});
test("label-like text in comments, strings and DATA is preserved", async () => {
  const { b, out } = setup();
  await b.run('10 REM *A\n20 DATA "*A"\n30 READ A$:PRINT A$\n40 PRINT "*A"');
  assert.equal(out(), "*A\n*A\n");
});
