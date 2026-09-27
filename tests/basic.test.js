import { test } from "node:test";
import assert from "node:assert/strict";
import { Basic } from "../dist/basic.js";
async function run(code, input) {
  let output = "";
  const b = new Basic({
    print: (s) => (output += s),
    input: async () => input,
  });
  await b.run(code);
  return { b, output };
}
test("Japanese strings and FOR loop", async () => {
  assert.equal(
    (await run('10 FOR I=1 TO 3\n20 PRINT "日本語";I\n30 NEXT I')).output,
    "日本語1\n日本語2\n日本語3\n",
  );
});
test("branch with colon applies to entire THEN", async () => {
  assert.equal(
    (
      await run(
        '10 IF 0 THEN PRINT "BAD":PRINT "BAD"\n20 IF 1 THEN GOTO 40\n30 PRINT "BAD"\n40 PRINT "OK"',
      )
    ).output,
    "OK\n",
  );
});
test("nested loops, subroutine and ordering", async () => {
  assert.equal(
    (
      await run(
        "50 END\n10 FOR I=1 TO 2\n20 FOR J=1 TO 2\n30 GOSUB 100\n35 NEXT J\n40 NEXT I\n100 PRINT I*J;\n110 RETURN",
      )
    ).output,
    "1224",
  );
});
test("DATA arrays and RESTORE", async () => {
  assert.equal(
    (
      await run(
        '10 DIM A(2),B$(1)\n20 DATA 5,"日本語"\n30 READ A(2),B$(1)\n40 PRINT A(2);B$(1)\n50 RESTORE\n60 READ X\n70 PRINT X',
      )
    ).output,
    "5日本語\n5\n",
  );
});
test("INPUT and string functions", async () => {
  assert.equal(
    (await run('10 INPUT "名前";N$\n20 PRINT LEFT$(N$,2)', "太郎さん")).output,
    "太郎\n",
  );
});
test("math precedence", () => {
  const b = new Basic();
  assert.equal(b.expression("-2^2+3*4"), 8);
  assert.equal(b.expression("2^3^2"), 512);
  assert.equal(b.expression("3>=2 AND 4<>5"), -1);
});
test("skip zero iteration loops", async () => {
  assert.equal(
    (await run('10 FOR I=2 TO 1\n20 PRINT "BAD"\n30 NEXT I\n40 PRINT "OK"'))
      .output,
    "OK\n",
  );
});
test("line-aware error and invalid target", async () => {
  await assert.rejects(run("10 GOTO 50"), /10行.*50/);
  await assert.rejects(run("10 PRINT 1/0"), /10行.*0で/);
});
test("stop infinite execution", async () => {
  const b = new Basic();
  setTimeout(() => b.stop(), 10);
  const result = await b.run("10 GOTO 10");
  assert.equal(result.stopped, true);
});
test("uninitialized string array is empty", async () => {
  assert.equal((await run("10 DIM A$(2)\n20 PRINT LEN(A$(1))")).output, "0\n");
});
test("graphics forwards coordinates and colors", async () => {
  const calls = [];
  const b = new Basic({
    line: (...a) => calls.push(a),
    circle: (...a) => calls.push(a),
  });
  await b.run("10 LINE (0,10)-(100,200),4,BF\n20 CIRCLE (320,200),50,6");
  assert.deepEqual(calls, [
    [0, 10, 100, 200, 4, "BF"],
    [320, 200, 50, 6],
  ]);
});
