import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";

test("editing masks only committed text and never paints over the graphics row", () => {
  let render;
  const fills = [];
  const context = {
    clearRect() {},
    save() {},
    beginPath() {},
    rect() {},
    clip() {},
    fillRect(...args) {
      fills.push(args);
    },
    fillText() {},
    restore() {},
  };
  const form = {
    hidden: false,
    style: { left: "0%", top: "20%" },
    appendChild() {},
  };
  const input = {
    disabled: false,
    value: "",
    selectionStart: 0,
    selectionEnd: 0,
    scrollLeft: 0,
    clientWidth: 640,
    closest: () => form,
    addEventListener() {},
  };
  const nodes = {
    gameScreen: { clientWidth: 640, appendChild() {}, classList: { add() {} } },
    textScreen: { style: {} },
    command: input,
    inputValue: { ...input, disabled: true },
  };
  const document = {
    getElementById: (id) => nodes[id],
    activeElement: input,
    hasFocus: () => true,
    addEventListener() {},
    createElement: () => ({
      style: {},
      setAttribute() {},
      getContext: () => context,
    }),
  };
  vm.runInNewContext(
    fs.readFileSync(new URL("../terminal-cursor.js", import.meta.url), "utf8"),
    {
      document,
      window: { addEventListener() {} },
      ResizeObserver: class {
        observe() {}
      },
      MutationObserver: class {
        observe() {}
      },
      requestAnimationFrame(callback) {
        render = callback;
        return 1;
      },
    },
  );
  render();
  assert.equal(fills.length, 0);
  assert.match(nodes.textScreen.style.clipPath, /100% 20%, 0% 20%, 0% 24%/);
  input.value = "PRINT 1";
  render();
  assert.equal(fills.length, 0);
  form.style.top = "24%";
  render();
  assert.match(nodes.textScreen.style.clipPath, /100% 24%, 0% 24%, 0% 28/);
  form.hidden = true;
  render();
  assert.equal(nodes.textScreen.style.clipPath, "");
});
