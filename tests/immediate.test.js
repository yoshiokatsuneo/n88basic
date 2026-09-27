import { test } from "node:test";
import assert from "node:assert/strict";
import { Basic } from "../dist/basic.js";
import { Session } from "../dist/session.js";
function setup(source = "", extra = {}) {
  let output = "";
  const b = new Basic({ print: (s) => (output += s), ...extra });
  const session = new Session(b, {
    getSource: () => source,
    setSource: (s) => (source = s),
    print: (s) => (output += s),
  });
  return { b, session, output: () => output, source: () => source };
}
test("direct commands preserve variables and arrays between submissions", async () => {
  const c = setup();
  await c.session.submit('A=12: DIM S$(2): S$(1)="日本語"');
  await c.session.submit("PRINT A*2;S$(1)");
  assert.equal(c.output(), "24日本語\n");
  assert.equal(c.source(), "");
});
test("direct FOR and IF share normal statement parsing", async () => {
  const c = setup();
  await c.session.submit("FOR I=1 TO 3: PRINT I;: NEXT I");
  await c.session.submit('IF 1 THEN PRINT "OK": PRINT 2');
  assert.equal(c.output(), "123OK\n2\n");
});
test("direct command does not fall through into stored program", async () => {
  const c = setup('0 PRINT "BAD"\n1 END');
  await c.session.submit('PRINT "OK"');
  assert.equal(c.output(), "OK\n");
});
test("direct GOSUB can enter stored code and return to direct command", async () => {
  const c = setup("10 A=A+1\n20 RETURN");
  await c.session.submit("A=5");
  await c.session.submit("GOSUB 10: PRINT A");
  assert.equal(c.output(), "6\n");
});
test("line edits insert, replace, sort and delete without executing", async () => {
  const c = setup();
  await c.session.submit("30 END");
  await c.session.submit('10 PRINT "OLD"');
  await c.session.submit('20 PRINT "REMOVE"');
  await c.session.submit('10 PRINT "NEW"');
  await c.session.submit("20");
  assert.equal(c.source(), '10 PRINT "NEW"\n30 END');
  assert.equal(c.output(), "");
  await c.session.submit("LIST");
  assert.equal(c.output(), c.source() + "\n");
});
test("LIST supports one line and open or closed ranges", async () => {
  const source = "10 REM A\n20 REM B\n30 END";
  for (const [cmd, expected] of [
    ["LIST 20", "20 REM B\n"],
    ["LIST 10-20", "10 REM A\n20 REM B\n"],
    ["LIST -20", "10 REM A\n20 REM B\n"],
    ["LIST 20-", "20 REM B\n30 END\n"],
  ]) {
    const c = setup(source);
    await c.session.submit(cmd);
    assert.equal(c.output(), expected);
  }
  await assert.rejects(setup(source).session.submit("LIST 30-10"), /範囲/);
});
test("RUN resets variables, supports start line and exposes results afterward", async () => {
  const c = setup("10 A=999\n20 A=A+2\n30 PRINT A");
  await c.session.submit("A=7");
  await c.session.submit("RUN 20");
  await c.session.submit("PRINT A");
  assert.equal(c.output(), "2\n2\n");
});
test("CLEAR preserves program; NEW clears both program and variables", async () => {
  const c = setup("10 END");
  await c.session.submit("A=8");
  await c.session.submit("CLEAR");
  assert.equal(c.b.get("A"), 0);
  assert.equal(c.source(), "10 END");
  await c.session.submit("A=9");
  await c.session.submit("NEW");
  assert.equal(c.source(), "");
  assert.equal(c.b.get("A"), 0);
});
test("INPUT works in immediate mode and values survive errors", async () => {
  const c = setup("", { input: async () => "太郎" });
  await c.session.submit('INPUT "名前";N$');
  await assert.rejects(
    c.session.submit("PRINT 1/0"),
    (e) => !e.message.includes("0行:"),
  );
  await c.session.submit("PRINT N$");
  assert.equal(c.output(), "太郎\n");
});
test("stored program errors retain their line number in direct GOTO", async () => {
  const c = setup("50 PRINT 1/0");
  await assert.rejects(c.session.submit("GOTO 50"), /50行:/);
});
test("stopping direct execution releases the session for the next command", async () => {
  const c = setup();
  const running = c.session.submit('SLEEP 60000: PRINT "BAD"');
  await assert.rejects(c.session.submit("NEW"), /実行中/);
  c.b.stop();
  assert.equal((await running).stopped, true);
  await c.session.submit('PRINT "OK"');
  assert.equal(c.output(), "OK\n");
});
test("READ advances across direct commands and RESTORE resets the pointer", async () => {
  const c = setup("10 DATA 3,4");
  await c.session.submit("READ A");
  await c.session.submit("READ B");
  await c.session.submit("RESTORE: READ C: PRINT A;B;C");
  assert.equal(c.output(), "343\n");
});
test("malformed source and multiline commands cannot silently overwrite code", async () => {
  const c = setup('PRINT "missing line"');
  await assert.rejects(c.session.submit("10 END"), /行番号/);
  assert.equal(c.source(), 'PRINT "missing line"');
  await assert.rejects(c.session.submit("10 END\n20 END"), /1行ずつ/);
});
test("direct PRINT works even when the editor has an unfinished program", async () => {
  const c = setup("print 3333");
  await c.session.submit("PRINT 3333");
  assert.equal(c.output(), "3333\n");
  await assert.rejects(c.session.submit("GOTO 10"), /行番号/);
  await assert.rejects(c.session.submit("RUN"), /行番号/);
  await c.session.submit("PRINT 42");
  assert.equal(c.output(), "3333\n42\n");
});
