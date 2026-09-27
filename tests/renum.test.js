import { test } from "node:test";
import assert from "node:assert/strict";
import { Session } from "../dist/session.js";
import { Basic } from "../dist/basic.js";
function fixture(source) {
  const b = new Basic();
  const s = new Session(b, {
    getSource: () => source,
    setSource: (v) => (source = v),
  });
  return { s, b, source: () => source };
}
test("RENUM defaults and references preserve runnable program", async () => {
  const f = fixture(
    "7 GOSUB 100\n25 IF A=1 THEN 90 ELSE 7\n90 END\n100 A=1:RETURN",
  );
  await f.s.submit("RENUM");
  assert.equal(
    f.source(),
    "10 GOSUB 40\n20 IF A=1 THEN 30 ELSE 10\n30 END\n40 A=1:RETURN",
  );
  await f.b.run(f.source());
  assert.equal(f.b.get("A"), 1);
});
test("partial renumber updates references in unchanged lines and ON lists", async () => {
  const f = fixture(
    "10 ON X GOTO 100,200:RESTORE 200\n100 GOTO 10\n200 DATA 100,200",
  );
  await f.s.submit("RENUM 500,100,20");
  assert.equal(
    f.source(),
    "10 ON X GOTO 500,520:RESTORE 520\n500 GOTO 10\n520 DATA 100,200",
  );
});
test("strings, data, comments and ordinary numbers are preserved", async () => {
  const f = fixture(
    '50 PRINT "GOTO 50":A=50:REM GOTO 50\n80 DATA GOTO 50,"x:y":GOTO 50\n90 \' GOTO 80',
  );
  await f.s.submit("RENUM 100,,5");
  assert.equal(
    f.source(),
    '100 PRINT "GOTO 50":A=50:REM GOTO 50\n105 DATA GOTO 50,"x:y":GOTO 100\n110 \' GOTO 80',
  );
});
test("invalid options, collisions, overflow and missing targets are atomic", async () => {
  for (const cmd of [
    "RENUM 10,20",
    "RENUM 65529,,10",
    "RENUM 0",
    "RENUM 10,,0",
    "RENUM 1,2,3,4",
    "RENUM X",
  ]) {
    const f = fixture("10 END\n20 END");
    await assert.rejects(f.s.submit(cmd));
    assert.equal(f.source(), "10 END\n20 END");
  }
  const f = fixture("20 GOTO 99");
  await assert.rejects(f.s.submit("RENUM"), /99/);
  assert.equal(f.source(), "20 GOTO 99");
});
test("omitted arguments and empty programs work", async () => {
  const f = fixture("1 END\n2 END");
  await f.s.submit("RENUM ,,5");
  assert.equal(f.source(), "10 END\n15 END");
  const empty = fixture("");
  await empty.s.submit("RENUM");
  assert.equal(empty.source(), "");
});
