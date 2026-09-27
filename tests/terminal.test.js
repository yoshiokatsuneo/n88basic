import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { Basic } from "../dist/basic.js";
import { Session } from "../dist/session.js";
import { Keyboard } from "../dist/keyboard.js";
// Minimal DOM fixture exercises the actual app's submission and shortcut handlers.
function terminal(confirmResult = true, savedSource = "10 END") {
  const storage = new Map(
    savedSource === null ? [] : [["n88-source", savedSource]],
  );
  const nodes = new Map(),
    listeners = new Map();
  let document;
  const cleared = [];
  const context = {
    clearRect() {},
    getImageData() {
      return {};
    },
    putImageData() {},
    fillText() {},
  };
  function node(id) {
    if (!nodes.has(id))
      nodes.set(id, {
        value: "",
        textContent: "",
        hidden: false,
        disabled: false,
        clientWidth: 640,
        style: { setProperty() {} },
        classList: {
          toggle() {},
          contains() {
            return false;
          },
        },
        getContext: () => ({ ...context, clearRect: () => cleared.push(id) }),
        setAttribute() {},
        contains(other) {
          return (
            id === "gameScreen" &&
            ["gameScreen", "command", "inputValue"].some(
              (key) => nodes.get(key) === other,
            )
          );
        },
        open: false,
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
          this.handlers.close?.();
        },
        replaceChildren(...children) {
          this.children = children;
          this.value = children[0]?.value ?? "";
        },
        handlers: {},
        selectionStart: 0,
        selectionEnd: 0,
        setSelectionRange(a, b) {
          this.selectionStart = a;
          this.selectionEnd = b;
        },
        focus() {
          document.activeElement = this;
        },
        addEventListener(event, fn) {
          this.handlers[event] = fn;
        },
      });
    return nodes.get(id);
  }
  document = {
    getElementById: node,
    createElement: () => ({ value: "", textContent: "" }),
    activeElement: null,
    body: node("body"),
    querySelectorAll: () => [],
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
  };
  vm.runInNewContext(
    fs.readFileSync(new URL("../app.js", import.meta.url), "utf8"),
    {
      document,
      window: { addEventListener() {} },
      ResizeObserver: class {
        observe() {}
      },
      performance,
      confirm: () => confirmResult,
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
      setTimeout,
      clearTimeout,
    },
  );
  return {
    node,
    cleared,
    submit(value) {
      node("command").value = value;
      return node("immediateForm").onsubmit({ preventDefault() {} });
    },
    key(ctrlKey, key) {
      let prevented = false;
      for (const fn of listeners.get("keydown") ?? [])
        fn({
          key,
          ctrlKey,
          preventDefault() {
            prevented = true;
          },
          stopPropagation() {},
        });
      return prevented;
    },
    arrow(key, altKey = false) {
      node("command").handlers.keydown({ key, altKey, preventDefault() {} });
    },
    copy() {
      let prevented = false;
      for (const fn of listeners.get("copy") ?? [])
        fn({
          preventDefault() {
            prevented = true;
          },
        });
      return prevented;
    },
    document,
  };
}
test("empty Enter advances the screen input and bottom-row Enter scrolls", async () => {
  const t = terminal();
  const initial = parseFloat(t.node("immediateForm").style.top);
  await t.submit("");
  assert.equal(parseFloat(t.node("immediateForm").style.top), initial + 4);
  await t.submit("   ");
  assert.equal(parseFloat(t.node("immediateForm").style.top), initial + 8);
  for (let i = 0; i < 30; i++) await t.submit("");
  assert.equal(t.node("immediateForm").style.top, "96%");
  assert.equal(t.node("command").disabled, false);
});
test("Ctrl+C interrupts INPUT and returns focus to the command line", async () => {
  const t = terminal(),
    done = t.submit("INPUT A");
  assert.equal(t.node("status").textContent, "INPUT");
  assert.equal(t.key(true, "c"), true);
  await done;
  assert.equal(t.node("status").textContent, "STOPPED");
  assert.equal(t.node("inputForm").hidden, true);
  assert.equal(t.document.activeElement, t.node("command"));
  assert.match(t.node("accessibleOutput").textContent, /Break\nOk\n$/);
  await t.submit("PRINT 42");
  assert.match(t.node("accessibleOutput").textContent, /42\nOk\n$/);
});
test("Ctrl+C interrupts SLEEP without waiting for the timer", async () => {
  const t = terminal(),
    done = t.submit('SLEEP 60000: PRINT "BAD"');
  t.key(true, "C");
  await done;
  assert.equal(t.node("status").textContent, "STOPPED");
  assert.doesNotMatch(t.node("accessibleOutput").textContent, /\nBAD\n/);
});
test("Ctrl+C interrupts a looping stored program and subsequent presses advance the prompt", async () => {
  const t = terminal();
  t.node("source").value = "10 GOTO 10";
  const done = t.submit("RUN");
  await new Promise((r) => setTimeout(r, 5));
  t.key(true, "c");
  await done;
  assert.equal(t.node("status").textContent, "STOPPED");
  const row = parseFloat(t.node("immediateForm").style.top);
  assert.equal(t.key(true, "c"), true);
  assert.equal(parseFloat(t.node("immediateForm").style.top), row + 4);
  t.key(true, "c");
  assert.equal(parseFloat(t.node("immediateForm").style.top), row + 8);
});

test("embedded-browser shortcut interrupts INPUT and advances the idle prompt", async () => {
  const t = terminal(),
    done = t.submit("INPUT A");
  assert.equal(t.copy(), true);
  await done;
  assert.equal(t.node("status").textContent, "STOPPED");
  const row = parseFloat(t.node("immediateForm").style.top);
  assert.equal(t.copy(), true);
  assert.equal(parseFloat(t.node("immediateForm").style.top), row + 4);
});

test("up/down moves screen rows and restores drafts, instead of browsing history", async () => {
  const t = terminal();
  const start = parseFloat(t.node("immediateForm").style.top);
  t.node("command").value = "PRINT 123";
  t.node("command").setSelectionRange(3, 3);
  t.arrow("ArrowUp");
  assert.equal(parseFloat(t.node("immediateForm").style.top), start - 4);
  assert.equal(t.node("command").value, "Ok ");
  t.arrow("ArrowDown");
  assert.equal(t.node("command").value, "PRINT 123");
  assert.equal(t.node("command").selectionStart, 3);
});
test("LIST rows can be selected and changed with Enter", async () => {
  const t = terminal();
  t.node("source").value = "10 PRINT 1\n20 PRINT 2";
  await t.submit("LIST");
  t.arrow("ArrowUp");
  t.arrow("ArrowUp");
  assert.equal(t.node("command").value, "20 PRINT 2");
  await t.submit("20 PRINT 99");
  assert.equal(t.node("source").value, "10 PRINT 1\n20 PRINT 99");
});
test("screen row selection stays within 25 rows after scrolling", async () => {
  const t = terminal();
  for (let i = 0; i < 30; i++) await t.submit("");
  for (let i = 0; i < 30; i++) t.arrow("ArrowUp");
  assert.equal(t.node("immediateForm").style.top, "0%");
  for (let i = 0; i < 30; i++) t.arrow("ArrowDown");
  assert.equal(t.node("immediateForm").style.top, "96%");
});

test("boot displays the requested AI title and TY attribution", () => {
  const t = terminal();
  assert.equal(
    t.node("accessibleOutput").textContent,
    "AI N-88 BASIC(86) version 3.0\nCopyright (C) 2026 by TY\n67108864 Bytes free\nOk\n",
  );
  assert.equal(t.node("immediateForm").style.top, "16%");
});

test("idle Ctrl+C cancels drafts without executing and still works at the bottom", () => {
  const t = terminal();
  t.node("command").value = "10 PRINT 999";
  t.key(true, "c");
  assert.equal(t.node("source").value, "10 END");
  assert.equal(t.node("command").value, "");
  for (let i = 0; i < 30; i++) t.key(true, "c");
  assert.equal(t.node("immediateForm").style.top, "96%");
  assert.equal(t.node("command").disabled, false);
});
test("idle selection copy and editor copy remain available", () => {
  const t = terminal();
  t.node("command").value = "copy me";
  t.node("command").setSelectionRange(0, 4);
  assert.equal(t.copy(), false);
  assert.equal(t.node("command").value, "copy me");
  t.node("source").focus();
  assert.equal(t.copy(), false);
  assert.equal(t.key(true, "c"), false);
});
test("clicking the running screen restores INKEY$ focus; editing keys reach it", async () => {
  const t = terminal();
  const execution = t.submit('WHILE K$="":K$=INKEY$:WEND:PRINT ASC(K$)');
  t.node("screenHelp").focus();
  t.node("gameScreen").handlers.click({ target: { closest: () => null } });
  assert.equal(t.document.activeElement, t.node("gameScreen"));
  assert.equal(t.key(false, "Backspace"), true);
  await execution;
  assert.match(t.node("accessibleOutput").textContent, /\n8\nOk/);
});

test("CLS selectively clears text and graphics and preserves graphics-only cursor", async () => {
  const t = terminal();
  await t.submit('PRINT "KEEP"');
  t.cleared.length = 0;
  await t.submit("CLS 2:PRINT CSRLIN");
  assert.ok(t.cleared.includes("graphics"));
  assert.match(t.node("accessibleOutput").textContent, /KEEP/);
  t.cleared.length = 0;
  await t.submit("CLS 1");
  assert.ok(!t.cleared.includes("graphics"));
  assert.ok(t.cleared.includes("textScreen"));
  assert.equal(t.node("accessibleOutput").textContent, "Ok\n");
  t.cleared.length = 0;
  await t.submit("CLS 3");
  assert.ok(t.cleared.includes("graphics"));
  assert.ok(t.cleared.includes("textScreen"));
});
test("unknown command prints Syntax error and Ok without a question-mark prefix", async () => {
  const t = terminal();
  await t.submit("BOGUS");
  assert.match(
    t.node("accessibleOutput").textContent,
    /BOGUS\nSyntax error\nOk\n$/,
  );
  assert.equal(t.node("command").disabled, false);
  t.node("source").value = "10 BOGUS";
  await t.node("run").onclick();
  assert.equal(
    t.node("accessibleOutput").textContent,
    "Syntax error in 10\nOk\n",
  );
  await t.submit("PRINT 123");
  assert.match(t.node("accessibleOutput").textContent, /123\nOk\n$/);
});
test("numbered line entry, replacement and deletion advance without Ok", async () => {
  const t = terminal();
  const before = t.node("accessibleOutput").textContent;
  await t.submit("10 PRINT 1");
  await t.submit("20 END");
  await t.submit("10 PRINT 2");
  await t.submit("20");
  assert.equal(
    t.node("accessibleOutput").textContent.slice(before.length),
    "10 PRINT 1\n20 END\n10 PRINT 2\n20\n",
  );
  assert.equal(t.node("source").value, "10 PRINT 2");
  await t.submit("LIST");
  assert.match(
    t.node("accessibleOutput").textContent,
    /LIST\n10 PRINT 2\nOk\n$/,
  );
  await t.submit("RUN");
  assert.match(t.node("accessibleOutput").textContent, /RUN\n2\nOk\n$/);
});
test("committing an edited LIST row keeps the next row visible and editable", async () => {
  const t = terminal();
  t.node("source").value = "10 PRINT 1\n20 PRINT 2\n30 END";
  await t.submit("LIST");
  for (let i = 0; i < 4; i++) t.arrow("ArrowUp");
  assert.equal(t.node("command").value, "10 PRINT 1");
  await t.submit("10 PRINT 99");
  assert.equal(t.node("command").value, "20 PRINT 2");
  assert.equal(t.node("command").selectionStart, 0);
  t.arrow("ArrowDown");
  t.arrow("ArrowUp");
  assert.equal(t.node("command").value, "20 PRINT 2");
  await t.submit("20 PRINT 88");
  assert.equal(t.node("command").value, "30 END");
  assert.equal(t.node("source").value, "10 PRINT 99\n20 PRINT 88\n30 END");
});
test("blank Enter also preserves the following screen row", async () => {
  const t = terminal();
  t.node("source").value = "10 PRINT 1\n20 END";
  await t.submit("LIST");
  for (let i = 0; i < 3; i++) t.arrow("ArrowUp");
  await t.submit("");
  assert.equal(t.node("command").value, "20 END");
  t.arrow("ArrowDown");
  t.arrow("ArrowUp");
  assert.equal(t.node("command").value, "20 END");
});

test("full-screen menus save and load through the shared program store", async () => {
  const t = terminal();
  t.node("screenSave").handlers.click();
  assert.equal(t.node("programDialog").open, true);
  t.node("programName").value = "メニューのテスト";
  t.node("programForm").handlers.submit({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(t.node("programNotice").textContent, /保存しました/);
  t.node("source").value = "10 PRINT 99";
  t.node("screenLoad").handlers.click();
  assert.equal(t.node("programList").value, "メニューのテスト");
  t.node("programForm").handlers.submit({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(t.node("source").value, "10 END");
  t.node("programCancel").handlers.click();
  assert.equal(t.document.activeElement, t.node("command"));
});

test("menu rejects command injection and allows cancellation before replacement", async () => {
  const t = terminal(false);
  t.node("screenLoad").handlers.click();
  assert.equal(t.node("programSubmit").disabled, true);
  t.node("screenSave").handlers.click();
  t.node("programName").value = 'bad"\nNEW';
  t.node("programForm").handlers.submit({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(t.node("programNotice").textContent, /引用符/);
  t.node("programName").value = "safe";
  t.node("programForm").handlers.submit({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));
  t.node("source").value = "10 PRINT 99";
  t.node("screenLoad").handlers.click();
  t.node("programForm").handlers.submit({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(t.node("source").value, "10 PRINT 99");
});

test("first launch starts empty and saved programs are restored", () => {
  assert.equal(terminal(true, null).node("source").value, "");
  assert.equal(terminal(true, "").node("source").value, "");
  assert.equal(
    terminal(true, "10 PRINT 42").node("source").value,
    "10 PRINT 42",
  );
});
