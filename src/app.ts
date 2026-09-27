import { playMusic } from "./music.js";
import { setupProgramMenu } from "./program-menu.js";
import { createGraphics } from "./graphics.js";
import { readPrograms, writePrograms } from "./storage.js";
import { Basic } from "./basic.js";
import { Session } from "./session.js";
import { Keyboard } from "./keyboard.js";
import { samples } from "./samples.js";
import type { RunResult, CommandResult } from "./types.js";
interface ScreenElements {
  screenSave: HTMLButtonElement;
  screenLoad: HTMLButtonElement;
  programDialog: HTMLDialogElement;
  lineCount: HTMLElement;
  sample: HTMLSelectElement;
  loadSample: HTMLButtonElement;
  gutter: HTMLElement;
  source: HTMLTextAreaElement;
  run: HTMLButtonElement;
  stop: HTMLButtonElement;
  import: HTMLButtonElement;
  save: HTMLButtonElement;
  file: HTMLInputElement;
  executionSpeed: HTMLSelectElement;
  status: HTMLElement;
  screenHelp: HTMLButtonElement;
  screenStop: HTMLButtonElement;
  toggleScreen: HTMLButtonElement;
  gameScreen: HTMLElement;
  graphics: HTMLCanvasElement;
  textScreen: HTMLCanvasElement;
  immediateForm: HTMLFormElement;
  command: HTMLInputElement;
  sendCommand: HTMLButtonElement;
  inputForm: HTMLFormElement;
  inputPrompt: HTMLElement;
  inputValue: HTMLInputElement;
  accessibleOutput: HTMLElement;
  gameControls: HTMLElement;
  message: HTMLElement;
  clear: HTMLButtonElement;
  help: HTMLDialogElement;
  closeHelp: HTMLButtonElement;
}
function $<K extends keyof ScreenElements>(id: K): ScreenElements[K] {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing screen element: ${id}`);
  }
  return element as ScreenElements[K];
}
const keyboard = new Keyboard();
const speedOptions = [0, 0.25, 0.5, 1, 2, 4];
let executionSpeed = 1;
try {
  const savedSpeed = localStorage.getItem("n88-speed");
  if (savedSpeed !== null && speedOptions.includes(Number(savedSpeed))) {
    executionSpeed = Number(savedSpeed);
  }
} catch {}
$("executionSpeed").value = String(executionSpeed);
$("executionSpeed").addEventListener("change", () => {
  const value = Number($("executionSpeed").value);
  if (!speedOptions.includes(value)) {
    return;
  }
  executionSpeed = value;
  try {
    localStorage.setItem("n88-speed", String(value));
  } catch {}
});
const colors = [
  "#000000",
  "#668eff",
  "#ed6b76",
  "#d18ef0",
  "#78dca3",
  "#70d7e3",
  "#f2d980",
  "#ffffff",
];
const g = $("graphics").getContext("2d")!,
  t = $("textScreen").getContext("2d")!;
let x = 0,
  y = 0,
  color = 7,
  running = false,
  pending: ((value: string) => void) | null = null;
let screenRows = Array.from({ length: 25 }, () => Array<string>(80).fill(" "));
function clear(mode = 3) {
  if (mode & 2) {
    g.clearRect(0, 0, 640, 400);
  }
  if (mode & 1) {
    screenRows = Array.from({ length: 25 }, () => Array<string>(80).fill(" "));
    t.clearRect(0, 0, 640, 400);
    x = y = 0;
    $("accessibleOutput").textContent = "";
    positionScreenInput();
  }
}
function newline() {
  x = 0;
  y++;
  if (y >= 25) {
    const img = t.getImageData(0, 16, 640, 384);
    t.clearRect(0, 0, 640, 400);
    t.putImageData(img, 0, 0);
    y = 24;
    screenRows.shift();
    screenRows.push(Array<string>(80).fill(" "));
  }
}
function print(str: string) {
  const output = $("accessibleOutput");
  output.textContent = (output.textContent + str).slice(-12000);
  t.font = "14px monospace";
  t.textBaseline = "top";
  for (const c of str) {
    if (c === "\n") {
      newline();
      continue;
    }
    const width = c.codePointAt(0)! > 255 ? 2 : 1;
    if (x + width > 80) {
      newline();
    }
    t.clearRect(x * 8, y * 16, width * 8, 16);
    t.fillStyle = colors[color];
    t.fillText(c, x * 8, y * 16, width * 8);
    screenRows[y][x] = c;
    if (width === 2) {
      screenRows[y][x + 1] = "";
    }
    x += width;
  }
  positionScreenInput();
}
// Native inputs sit on the text cursor: selection, paste and IME remain native.
function positionScreenInput() {
  const screen = $("gameScreen");
  const scale = screen.clientWidth / 640;
  const left = Math.min(x, 79) * 8;
  for (const id of ["immediateForm", "inputForm"] as const) {
    const form = $(id);
    form.style.left = (left / 640) * 100 + "%";
    form.style.top = (y / 25) * 100 + "%";
    form.style.width = ((640 - left) / 640) * 100 + "%";
    form.style.height = 16 * scale + "px";
  }
  screen.style.setProperty("--terminal-font", 14 * scale + "px");
  screen.style.setProperty("--terminal-line", 16 * scale + "px");
  if (typeof CustomEvent !== "undefined") {
    document.dispatchEvent(new CustomEvent("terminal-layout"));
  }
}
const { selectedColor, point, paint } = createGraphics(g, colors, () => color);
let audioContext: AudioContext | undefined;
function beep() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) {
    throw new Error("このブラウザでは音を再生できません");
  }
  audioContext ??= new Audio();
  audioContext.resume().catch(reportAsyncError);
  const oscillator = audioContext.createOscillator(),
    gain = audioContext.createGain();
  oscillator.frequency.value = 880;
  gain.gain.value = 0.08;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.12);
}

const basic = new Basic({
  speed: () => executionSpeed,
  print,
  clear,
  point,
  paint,
  beep,
  play: (notes, signal) => {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) {
      throw new Error("このブラウザでは音を再生できません");
    }
    audioContext ??= new Audio();
    return playMusic(audioContext, notes, signal);
  },
  cursor: () => ({ x, y }),
  inkey: () => keyboard.read(true),
  keydown: (key) => keyboard.isDown(key),
  color: (c) => {
    color = ((Math.trunc(c) % 8) + 8) % 8;
  },
  locate: (a, b) => {
    x = Math.max(0, Math.min(79, Math.trunc(a)));
    y = Math.max(0, Math.min(24, Math.trunc(b ?? y)));
  },
  pset: (a, b, c) => {
    g.fillStyle = selectedColor(c);
    g.fillRect(a, b, 1, 1);
  },
  line: (a, b, c, d, col, box) => {
    g.strokeStyle = g.fillStyle = selectedColor(col);
    if (box === "BF") {
      g.fillRect(
        Math.min(a, c),
        Math.min(b, d),
        Math.abs(c - a) + 1,
        Math.abs(d - b) + 1,
      );
    } else if (box === "B") {
      g.strokeRect(a, b, c - a, d - b);
    } else {
      g.beginPath();
      g.moveTo(a, b);
      g.lineTo(c, d);
      g.stroke();
    }
  },
  circle: (a, b, r, c) => {
    if (r < 0) {
      throw new Error("半径は0以上にしてください");
    }
    g.strokeStyle = selectedColor(c);
    g.beginPath();
    g.arc(a, b, r, 0, Math.PI * 2);
    g.stroke();
  },
  input: (prompt) =>
    new Promise((resolve) => {
      print(prompt + " ");
      if (x >= 79) {
        newline();
        positionScreenInput();
      }
      $("inputForm").hidden = false;
      $("inputPrompt").textContent = prompt;
      $("inputValue").value = "";
      $("inputValue").focus();
      $("status").textContent = "INPUT";
      pending = resolve;
    }),
  cancelInput: () => {
    if (pending) {
      const resolve = pending;
      pending = null;
      $("inputForm").hidden = true;
      resolve("");
    }
  },
});
function update() {
  const n = $("source").value.split("\n").length;
  $("lineCount").textContent = n + " LINES";
  $("gutter").textContent = Array.from({ length: n }, (_, i) =>
    String(i + 1),
  ).join("\n");
  try {
    localStorage.setItem("n88-source", $("source").value);
  } catch {}
}
$("source").addEventListener("input", update);
$("source").addEventListener("scroll", () => {
  $("gutter").scrollTop = $("source").scrollTop;
});
const session = new Session(basic, {
  getSource: () => $("source").value,
  readPrograms: () => readPrograms(localStorage),
  writePrograms: (programs) => writePrograms(localStorage, programs),
  setSource: (value) => {
    $("source").value = value;
    update();
  },
  print,
});
function setBusy(busy: boolean) {
  running = busy;
  keyboard.clear();
  for (const id of [
    "run",
    "loadSample",
    "import",
    "clear",
    "command",
    "sendCommand",
    "screenSave",
    "screenLoad",
  ] as const) {
    $(id).disabled = busy;
  }
  $("stop").disabled = !busy;
  $("screenStop").disabled = !busy;
  $("immediateForm").hidden = busy;
  positionScreenInput();
}
async function execute(
  work: () => Promise<RunResult | CommandResult>,
  { freshScreen = false, direct = false } = {},
) {
  if (running) {
    return;
  }
  setBusy(true);
  $("gameScreen").focus({ preventScroll: true });
  $("status").textContent = "RUNNING";
  $("message").className = "";
  $("message").textContent = direct
    ? "即時コマンドを実行しています…"
    : "プログラムを実行しています…";
  if (freshScreen) {
    color = 7;
    clear();
  }
  let preserveNextRow = false;
  try {
    const result = await work();
    preserveNextRow = !!("silent" in result && result.silent);
    $("message").textContent = result.stopped
      ? "実行を停止しました。"
      : direct
        ? "Ok — 次の命令を入力できます。"
        : "実行が完了しました。";
    $("status").textContent = result.stopped ? "STOPPED" : "READY";
    if (result.stopped) {
      color = 7;
      if (x !== 0) {
        print("\n");
      }
      print("Break\nOk\n");
    } else if (direct && !("silent" in result && result.silent)) {
      if (x !== 0) {
        print("\n");
      }
      print("Ok\n");
    }
  } catch (error) {
    // Error objects may originate from another realm (embedded browser or tests).
    const e = typeof error === "object" && error !== null ? error : {};
    const message = "message" in e ? String(e.message) : String(error);
    const syntax = "code" in e && e.code === "SYNTAX";
    $("message").textContent = message;
    $("message").className = "error";
    $("status").textContent = "ERROR";
    if (direct || syntax) {
      if (x !== 0) {
        print("\n");
      }
      print((syntax ? "" : "? ") + message + "\nOk\n");
    }
  } finally {
    if (x !== 0) {
      print("\n");
    }
    if (preserveNextRow) {
      loadScreenRow();
    }
    setBusy(false);
    $("inputForm").hidden = true;
    $("command").focus({ preventScroll: true });
  }
}
async function run() {
  setExpanded(true);
  const source = $("source").value.trim();
  if (source && !/^\d/.test(source) && !/[\r\n]/.test(source)) {
    return execute(() => session.submit(source), { direct: true });
  }
  return execute(() => basic.run(source), { freshScreen: true });
}
function paintScreenRow(value: string) {
  t.clearRect(0, y * 16, 640, 16);
  screenRows[y] = Array<string>(80).fill(" ");
  t.font = "14px monospace";
  t.textBaseline = "top";
  t.fillStyle = colors[7];
  let col = 0;
  for (const c of value) {
    const width = c.codePointAt(0)! > 255 ? 2 : 1;
    if (col + width > 80) {
      break;
    }
    screenRows[y][col] = c;
    if (width === 2) {
      screenRows[y][col + 1] = "";
    }
    t.fillText(c, col * 8, y * 16, width * 8);
    col += width;
  }
}
function moveScreenRow(direction: number) {
  if (running) {
    return;
  }
  const input = $("command"),
    next = Math.max(0, Math.min(24, y + direction));
  if (next === y) {
    return;
  }
  const column = Array.from(
    input.value.slice(0, input.selectionStart ?? 0),
  ).reduce((n, c) => n + (c.codePointAt(0)! > 255 ? 2 : 1), 0);
  paintScreenRow(input.value);
  y = next;
  x = 0;
  loadScreenRow(column);
}
function loadScreenRow(column = 0) {
  const input = $("command");
  let value = screenRows[y].join("").trimEnd(),
    col = 0,
    index = 0;
  while (index < value.length && col < column) {
    const c = String.fromCodePoint(value.codePointAt(index)!);
    col += c.codePointAt(0)! > 255 ? 2 : 1;
    index += c.length;
  }
  if (col < column) {
    value += " ".repeat(column - col);
    index = value.length;
  }
  input.value = value;
  input.setSelectionRange(index, index);
  positionScreenInput();
}
const commandHistory: string[] = [];
let historyIndex = 0,
  historyDraft = "";
$("immediateForm").onsubmit = async (e) => {
  e.preventDefault();
  if (running) {
    return;
  }
  const command = $("command").value.trim();
  if (!command) {
    $("command").value = "";
    historyIndex = commandHistory.length;
    historyDraft = "";
    paintScreenRow("");
    print("\n");
    loadScreenRow();
    return;
  }
  if (commandHistory.at(-1) !== command) {
    commandHistory.push(command);
  }
  if (commandHistory.length > 100) {
    commandHistory.shift();
  }
  historyIndex = commandHistory.length;
  historyDraft = "";
  $("command").value = "";
  if (x !== 0) {
    print("\n");
  }
  paintScreenRow("");
  print(command + "\n");
  await execute(() => session.submit(command), { direct: true });
};
$("command").addEventListener("keydown", (e) => {
  if (e.isComposing || e.keyCode === 229) {
    if (e.key === "Enter") {
      e.preventDefault();
    }
    return;
  }
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    if (!e.altKey) {
      moveScreenRow(e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (historyIndex === commandHistory.length) {
      historyDraft = $("command").value;
    }
    historyIndex = Math.max(
      0,
      Math.min(
        commandHistory.length,
        historyIndex + (e.key === "ArrowUp" ? -1 : 1),
      ),
    );
    $("command").value = commandHistory[historyIndex] ?? historyDraft;
  }
});
$("run").onclick = run;
$("stop").onclick = () => basic.stop();
$("clear").onclick = () => {
  clear();
  $("command").focus({ preventScroll: true });
};
$("inputForm").onsubmit = (e) => {
  e.preventDefault();
  if (pending) {
    const value = $("inputValue").value;
    print(value + "\n");
    const resolve = pending;
    pending = null;
    $("inputForm").hidden = true;
    $("status").textContent = "RUNNING";
    $("gameScreen").focus({ preventScroll: true });
    resolve(value);
  }
};
function loadSample(name: string) {
  if (running) {
    return false;
  }
  if (
    $("source").value !== samples[name] &&
    !confirm(
      "現在のプログラムをサンプルに置き換えますか？ 大切なコードは先に保存してください。",
    )
  ) {
    return false;
  }
  $("source").value = samples[name];
  $("source").scrollTop = 0;
  $("sample").value = name;
  update();
  return true;
}
$("loadSample").onclick = () => loadSample($("sample").value);
$("save").onclick = () => {
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([$("source").value], { type: "text/plain;charset=utf-8" }),
    );
  a.href = url;
  a.download = "program.bas";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("import").onclick = () => $("file").click();
$("file").onchange = async () => {
  const file = $("file").files?.[0];
  if (!file) {
    return;
  }
  if (file.size > 1000000) {
    alert("1MB以下のファイルを選んでください。");
    return;
  }
  const value = await file.text();
  if (confirm("現在のプログラムを読み込んだファイルに置き換えますか？")) {
    $("source").value = value;
    update();
  }
  $("file").value = "";
};
// Game keys are captured only while the output or its controls have focus.
const gameScreen = $("gameScreen");
new ResizeObserver(positionScreenInput).observe(gameScreen);
gameScreen.addEventListener("click", (e) => {
  if ((e.target as Element).closest("input,button")) {
    return;
  }
  if (pending) {
    $("inputValue").focus({ preventScroll: true });
  } else if (!running) {
    $("command").focus({ preventScroll: true });
  } else {
    gameScreen.focus({ preventScroll: true });
  }
});
gameScreen.addEventListener("focus", () => {
  if (pending) {
    $("inputValue").focus({ preventScroll: true });
  } else if (!running) {
    $("command").focus({ preventScroll: true });
  }
});
$("inputValue").addEventListener("keydown", (e) => {
  if ((e.isComposing || e.keyCode === 229) && e.key === "Enter") {
    e.preventDefault();
  }
});
function gameFocused() {
  return (
    document.activeElement === gameScreen ||
    $("gameControls").contains(document.activeElement)
  );
}
document.addEventListener("keydown", (e) => {
  if (
    !running ||
    pending ||
    !gameFocused() ||
    e.isComposing ||
    e.metaKey ||
    e.ctrlKey ||
    e.altKey
  ) {
    return;
  }
  if (["Escape", "Tab"].includes(e.key)) {
    return;
  }
  if (
    e.key.length === 1 ||
    [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Enter",
      "Backspace",
      "Delete",
    ].includes(e.key)
  ) {
    e.preventDefault();
    keyboard.press(e.key, "keyboard:" + e.code, e.repeat);
  }
});
document.addEventListener("keyup", (e) =>
  keyboard.release("keyboard:" + e.code),
);
window.addEventListener("blur", () => keyboard.clear());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keyboard.clear();
  }
});
document.addEventListener("focusin", () => {
  if (!gameFocused()) {
    keyboard.clear();
  }
});
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-game-key]",
)) {
  button.addEventListener("pointerdown", (e) => {
    if (!running || pending) {
      return;
    }
    e.preventDefault();
    gameScreen.focus({ preventScroll: true });
    button.setPointerCapture(e.pointerId);
    keyboard.press(button.dataset.gameKey!, "pointer:" + e.pointerId);
    button.classList.add("pressed");
  });
  const release = (e: PointerEvent) => {
    keyboard.release("pointer:" + e.pointerId);
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("click", (e) => {
    if (e.detail === 0 && running && !pending) {
      keyboard.press(button.dataset.gameKey!, "accessible");
      keyboard.release("accessible");
    }
  });
}
function interruptTerminal() {
  keyboard.clear();
  if (running) {
    basic.stop();
    return;
  }
  const input = $("command"),
    draft = input.value;
  input.value = "";
  input.setSelectionRange(0, 0);
  historyIndex = commandHistory.length;
  historyDraft = "";
  x = 0;
  paintScreenRow("");
  print(draft + "\n");
  $("status").textContent = "READY";
  $("message").className = "";
  $("message").textContent = "入力を取り消しました。";
  input.focus({ preventScroll: true });
}
function terminalHasSelection() {
  const input = document.activeElement as HTMLInputElement | null;
  return (
    (input === $("command") || input === $("inputValue")) &&
    input.selectionStart !== input.selectionEnd
  );
}
// Ctrl+C also cancels the prompt after execution has already stopped.
document.addEventListener(
  "keydown",
  (e) => {
    const inTerminal = gameScreen.contains(document.activeElement);
    const copyKey =
      e.metaKey && inTerminal && (running || !terminalHasSelection());
    if (
      (running || inTerminal) &&
      !e.altKey &&
      (e.ctrlKey || copyKey) &&
      (e.key.toLowerCase() === "c" || e.code === "KeyC")
    ) {
      e.preventDefault();
      e.stopPropagation();
      interruptTerminal();
    }
  },
  true,
);
// Embedded WebKit can deliver the shortcut as copy rather than keydown.
// Preserve ordinary selection copying while idle.
document.addEventListener("copy", (e) => {
  if (
    gameScreen.contains(document.activeElement) &&
    (running || !terminalHasSelection())
  ) {
    e.preventDefault();
    interruptTerminal();
  }
});
$("screenHelp").onclick = () => $("help").showModal();
$("closeHelp").onclick = () => $("help").close();
document.addEventListener("keydown", (e) => {
  if ($("programDialog").open) {
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    run().catch(reportAsyncError);
  }
  if (e.key === "Escape" && running) {
    basic.stop();
  }
});
let saved;
try {
  saved = localStorage.getItem("n88-source");
} catch {}
$("source").value = saved ?? samples.hello;
const matchingSample = Object.keys(samples).find(
  (name) => samples[name] === $("source").value,
);
if (matchingSample) {
  $("sample").value = matchingSample;
}
update();
clear(); // Customized retro startup display.
print(
  "AI N-88 BASIC(86) version 3.0\nCopyright (C) 2026 by TY\n67108864 Bytes free\nOk\n",
);

function setExpanded(expanded: boolean) {
  document.body.classList.toggle("terminal-expanded", expanded);
  $("toggleScreen").textContent = expanded ? "コード・保存" : "BASIC画面へ";
  $("toggleScreen").setAttribute("aria-pressed", String(expanded));
  positionScreenInput();
  if (!expanded) {
    $("source").focus({ preventScroll: true });
    return;
  }
  if (pending) {
    $("inputValue").focus({ preventScroll: true });
  } else if (running) {
    gameScreen.focus({ preventScroll: true });
  } else {
    $("command").focus({ preventScroll: true });
  }
}
$("toggleScreen").onclick = () =>
  setExpanded(!document.body.classList.contains("terminal-expanded"));
$("screenStop").onclick = () => basic.stop();
setExpanded(
  typeof location === "undefined" ||
    new URLSearchParams(location.search).get("editor") !== "1",
);

function reportAsyncError(error: unknown): void {
  $("message").textContent =
    error instanceof Error ? error.message : String(error);
  $("message").className = "error";
  $("status").textContent = "ERROR";
}

setupProgramMenu({
  submit: (command) => session.submit(command),
  readPrograms: () => readPrograms(localStorage),
  isRunning: () => running,
  onLoaded: () => {
    $("command").value = "";
    $("status").textContent = "READY";
  },
  onClose: () => {
    $("command").focus({ preventScroll: true });
  },
  download: () => $("save").click(),
  importFile: () => $("file").click(),
});
