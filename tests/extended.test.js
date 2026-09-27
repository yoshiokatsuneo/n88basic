import { test } from "node:test";
import assert from "node:assert/strict";
import { Basic } from "../dist/basic.js";
import { Session } from "../dist/session.js";
async function run(source, io = {}) {
  let output = "";
  const b = new Basic({ print: (s) => (output += s), ...io });
  await b.run(source);
  return { b, output };
}
test("computed branches choose subroutine and return; zero skips", async () => {
  const { output } = await run(
    '10 ON 0 GOTO 999\n20 ON 2 GOSUB 100,200\n30 PRINT "END":END\n100 PRINT "BAD":RETURN\n200 PRINT "OK":RETURN',
  );
  assert.equal(output, "OK\nEND\n");
  await assert.rejects(run("10 ON -1 GOTO 10"), /選択番号/);
});
test("nested WHILE loops and false loops skip correctly", async () => {
  const { b } = await run(
    "10 WHILE I<3\n20 J=0\n30 WHILE J<2\n40 S=S+1:J=J+1\n50 WEND\n60 I=I+1\n70 WEND\n80 WHILE 0\n90 S=999\n100 WEND",
  );
  assert.equal(b.get("S"), 6);
  await assert.rejects(run("10 WEND"), /WHILE/);
});
test("DEF FN restores parameters, including after errors", async () => {
  const { b } = await run(
    "10 X=9:DEF FNA(X)=X*X\n20 Y=FNA(4)\n30 DEF FNB(X)=1/0",
  );
  assert.equal(b.get("X"), 9);
  assert.equal(b.get("Y"), 16);
  assert.throws(() => b.expression("FNB(1)"), /0で/);
  assert.equal(b.get("X"), 9);
});
test("default types, base, erase and swap work with arrays", async () => {
  const { b } = await run(
    '10 DEFSTR A:DEFINT I-N:OPTION BASE 1\n20 DIM A(2),B#(2):A(1)="日本語":I=2.7\n30 X=1:Y=2:SWAP X,Y\n40 ERASE B#:DIM B#(3)',
  );
  assert.equal(b.expression("A(1)"), "日本語");
  assert.equal(b.get("I"), 3);
  assert.equal(b.get("X"), 2);
  assert.throws(() => b.expression("A(0)"), /範囲外/);
});
test("string search, repetition, conversion and MID assignment", async () => {
  const { b } = await run('10 A$="ABCDE":MID$(A$,2,2)="xyzzz"');
  assert.equal(b.get("A$"), "AxyDE");
  for (const [expr, value] of [
    ['INSTR(3,"ABABA","BA")', 4],
    ["STRING$(3,65)", "AAA"],
    ["HEX$(&HFF)", "FF"],
    ["OCT$(8)", "10"],
    ['RIGHT$("ABC",0)', ""],
    ["CINT(2.8)", 3],
    ["&O10+&H10", 24],
  ])
    assert.equal(b.expression(expr), value);
  assert.throws(() => b.expression('STRING$(-1,"a")'), /範囲外/);
});
test("LINE INPUT preserves commas and spaces; stop cancels it", async () => {
  const { b } = await run('10 LINE INPUT "名前";A$', {
    input: async () => "  A,B  ",
  });
  assert.equal(b.get("A$"), "  A,B  ");
  let resolve;
  const c = new Basic({ input: () => new Promise((r) => (resolve = r)) });
  const pending = c.immediate("LINE INPUT A$", "");
  c.stop();
  resolve("ignored");
  await pending;
  assert.equal(c.get("A$"), "");
});
test("RANDOMIZE repeats sequences and RND(0) repeats last result", async () => {
  const { b } = await run(
    "10 RANDOMIZE 42:A=RND(1):B=RND(0)\n20 RANDOMIZE 42:C=RND(1)",
  );
  assert.equal(b.get("A"), b.get("B"));
  assert.equal(b.get("A"), b.get("C"));
  assert.ok(b.get("A") >= 0 && b.get("A") < 1);
});
test("NEXT list closes nested loops", async () => {
  const { b } = await run(
    "10 FOR I=1 TO 2\n20 FOR J=1 TO 3\n30 S=S+1\n40 NEXT J,I",
  );
  assert.equal(b.get("S"), 6);
});
test("PRINT USING formats decimal and string fields", async () => {
  assert.equal(
    (
      await run(
        '10 PRINT USING "###.##";12.3\n20 PRINT USING "! &";"ABC";"日本語"',
      )
    ).output,
    " 12.30\nA 日本語\n",
  );
});
test("ELSE inside printed strings is not a branch", async () => {
  assert.equal(
    (await run('10 IF 1 THEN PRINT " ELSE " ELSE PRINT "BAD"')).output,
    " ELSE \n",
  );
});
test("new graphics, cursor functions and beep forward to host", async () => {
  const calls = [];
  const { b } = await run(
    "10 PRESET (1,2)\n20 PAINT (3,4),2,7\n30 BEEP\n40 A=POINT(3,4):B=POS(0):C=CSRLIN",
    {
      pset: (...a) => calls.push(a),
      paint: (...a) => calls.push(a),
      beep: () => calls.push("beep"),
      point: () => 2,
      cursor: () => ({ x: 5, y: 6 }),
    },
  );
  assert.deepEqual(calls, [[1, 2, 0], [3, 4, 2, 7], "beep"]);
  assert.equal(b.get("A"), 2);
  assert.equal(b.get("B"), 5);
  assert.equal(b.get("C"), 6);
});
test("logical operators and time strings", () => {
  const b = new Basic();
  assert.equal(b.expression("5 XOR 3"), 6);
  assert.equal(b.expression("5 EQV 3"), -7);
  assert.equal(b.expression("0 IMP 0"), -1);
  assert.match(b.expression("TIME$"), /^\d{2}:\d{2}:\d{2}$/);
  assert.match(b.expression("DATE$"), /^\d{4}\/\d{2}\/\d{2}$/);
});
test("named save, load, merge, files and delete preserve program edits", async () => {
  let source = '10 PRINT "one"\n20 END',
    out = "",
    store = {};
  const b = new Basic({ print: (s) => (out += s) }),
    s = new Session(b, {
      getSource: () => source,
      setSource: (v) => (source = v),
      print: (v) => (out += v),
      readPrograms: () => JSON.parse(JSON.stringify(store)),
      writePrograms: (v) => (store = v),
    });
  await s.submit('SAVE "ONE",A');
  await s.submit("NEW");
  await s.submit('LOAD "ONE"');
  assert.match(source, /one/);
  source = '10 PRINT "two"\n30 END';
  await s.submit('SAVE "TWO"');
  await s.submit('LOAD "ONE"');
  await s.submit('MERGE "TWO"');
  assert.equal(source, '10 PRINT "two"\n20 END\n30 END');
  await s.submit("DELETE 20-");
  assert.equal(source, '10 PRINT "two"');
  await s.submit("FILES");
  assert.equal(out, "ONE\nTWO\n");
  out = "";
  await s.submit('LOAD "ONE",R');
  assert.equal(out, "one\n");
  const before = source;
  await assert.rejects(s.submit('LOAD "MISSING"'), /ありません/);
  assert.equal(source, before);
});
test("save failure reports an error and leaves source intact", async () => {
  const s = new Session(new Basic(), {
    getSource: () => "10 END",
    readPrograms: () => ({}),
    writePrograms: () => {
      throw new Error("容量不足");
    },
  });
  await assert.rejects(s.submit('SAVE "test"'), /容量不足/);
});
test("zero-iteration FOR skips nested loops with a shared NEXT", async () => {
  let result = await run(
    "10 FOR I=1 TO 0\n20 FOR J=1 TO 2\n30 S=999\n40 NEXT J,I\n50 A=1",
  );
  assert.equal(result.b.get("S"), 0);
  assert.equal(result.b.get("A"), 1);
  result = await run(
    "10 FOR I=1 TO 2\n20 S=S+1\n30 FOR J=1 TO 0\n40 S=999\n50 NEXT J,I",
  );
  assert.equal(result.b.get("S"), 2);
});
test("CLS defaults to text, accepts mode expressions and rejects invalid modes", async () => {
  const modes = [];
  await run("10 CLS:CLS 1:CLS 2:CLS 1+2", { clear: (m) => modes.push(m) });
  assert.deepEqual(modes, [1, 1, 2, 3]);
  for (const value of ["0", "4", "-1", "1.5", '"2"'])
    await assert.rejects(run("10 CLS " + value), /CLSの引数/);
});
test("unknown statements use BASIC syntax error messages with the executing line", async () => {
  const b = new Basic();
  await assert.rejects(
    b.immediate("BOGUS", ""),
    (e) => e.message === "Syntax error" && e.code === "SYNTAX",
  );
  await assert.rejects(
    b.run('10 PRINT "OK"\n20 BOGUS'),
    (e) => e.message === "Syntax error in 20",
  );
  await assert.rejects(
    b.immediate("GOSUB 100", "100 IF 1 THEN BOGUS"),
    (e) => e.message === "Syntax error in 100",
  );
  await b.immediate("A=42", "");
  assert.equal(b.get("A"), 42);
});
