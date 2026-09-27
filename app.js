// Generated from src/*.ts. Do not edit directly.
"use strict";
(() => {
  // src/errors.ts
  var BasicError = class extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
    code;
  };

  // src/music.ts
  function parseMusic(source) {
    if (source.length > 4096) {
      throw new BasicError("PLAY\u306E\u6587\u5B57\u5217\u306F4096\u6587\u5B57\u4EE5\u5185\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    }
    const text = source.replace(/\s+/g, "").toUpperCase();
    const notes = [];
    const pitches = {
      C: 0,
      D: 2,
      E: 4,
      F: 5,
      G: 7,
      A: 9,
      B: 11
    };
    let position = 0;
    let tempo = 120;
    let octave = 4;
    let length = 4;
    let volume = 8;
    let total = 0;
    function number(min, max, fallback) {
      const digits = text.slice(position).match(/^\d+/)?.[0];
      if (digits === void 0) {
        if (fallback !== void 0) {
          return fallback;
        }
        throw new BasicError("PLAY\u306B\u6570\u5024\u304C\u5FC5\u8981\u3067\u3059");
      }
      position += digits.length;
      const value = Number(digits);
      if (!Number.isInteger(value) || value < min || value > max) {
        throw new BasicError(`PLAY\u306E\u6570\u5024\u306F${min}\u301C${max}\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044`);
      }
      return value;
    }
    while (position < text.length) {
      const command = text.charAt(position++);
      if (command === "T") {
        tempo = number(32, 255);
        continue;
      }
      if (command === "O") {
        octave = number(1, 8);
        continue;
      }
      if (command === "L") {
        length = number(1, 64);
        continue;
      }
      if (command === "V") {
        volume = number(0, 15);
        continue;
      }
      if (command === ">" || command === "<") {
        octave += command === ">" ? 1 : -1;
        if (octave < 1 || octave > 8) {
          throw new BasicError("PLAY\u306E\u30AA\u30AF\u30BF\u30FC\u30D6\u306F1\u301C8\u3067\u3059");
        }
        continue;
      }
      const pitch = pitches[command];
      if (pitch === void 0 && command !== "R") {
        throw new BasicError(`PLAY\u306E\u672A\u5BFE\u5FDC\u6307\u5B9A: ${command}`);
      }
      let accidental = 0;
      if (command !== "R" && ["#", "+", "-"].includes(text.charAt(position))) {
        accidental = text.charAt(position++) === "-" ? -1 : 1;
      }
      let seconds = 240 / tempo / number(1, 64, length);
      let extra = seconds / 2;
      while (text.charAt(position) === ".") {
        seconds += extra;
        extra /= 2;
        position++;
      }
      total += seconds;
      if (total > 600) {
        throw new BasicError("PLAY\u306F1\u56DE10\u5206\u4EE5\u5185\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      }
      notes.push({
        frequency: pitch === void 0 ? null : 440 * 2 ** (((octave + 1) * 12 + pitch + accidental - 69) / 12),
        seconds,
        volume: volume / 15
      });
    }
    return notes;
  }
  function playMusic(context, notes, signal) {
    if (signal.aborted || notes.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const voices = [];
      let timer;
      let finished = false;
      function finish(error) {
        if (finished) {
          return;
        }
        finished = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        for (const { oscillator, gain } of voices) {
          oscillator.stop();
          oscillator.disconnect();
          gain.disconnect();
        }
        if (error !== void 0) {
          reject(error);
        } else {
          resolve();
        }
      }
      function abort() {
        finish();
      }
      signal.addEventListener("abort", abort, { once: true });
      context.resume().then(() => {
        if (finished) {
          return;
        }
        const start = context.currentTime + 0.01;
        let time = start;
        for (const note of notes) {
          if (note.frequency !== null && note.volume > 0) {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = "triangle";
            oscillator.frequency.value = note.frequency;
            const end = time + note.seconds * 0.9;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.12 * note.volume, time + 3e-3);
            gain.gain.setValueAtTime(
              0.12 * note.volume,
              Math.max(time + 3e-3, end - 5e-3)
            );
            gain.gain.linearRampToValueAtTime(0, end);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(time);
            oscillator.stop(time + note.seconds);
            voices.push({ oscillator, gain });
          }
          time += note.seconds;
        }
        timer = setTimeout(
          () => finish(),
          Math.max(0, time - context.currentTime) * 1e3
        );
      }).catch(finish);
    });
  }

  // src/program-menu.ts
  function setupProgramMenu(options) {
    const dialog = document.getElementById("programDialog");
    const title = document.getElementById("programDialogTitle");
    const form = document.getElementById("programForm");
    const name = document.getElementById("programName");
    const list = document.getElementById("programList");
    const message = document.getElementById("programNotice");
    const submit = document.getElementById("programSubmit");
    let mode = "save";
    let busy = false;
    function open(nextMode) {
      if (options.isRunning()) {
        return;
      }
      mode = nextMode;
      title.textContent = mode === "save" ? "\u30D7\u30ED\u30B0\u30E9\u30E0\u3092\u4FDD\u5B58" : "\u30D7\u30ED\u30B0\u30E9\u30E0\u3092\u8AAD\u307F\u8FBC\u307F";
      name.hidden = mode !== "save";
      name.required = mode === "save";
      list.hidden = mode !== "load";
      submit.textContent = mode === "save" ? "\u4FDD\u5B58\u3059\u308B" : "\u8AAD\u307F\u8FBC\u3080";
      message.textContent = "";
      submit.disabled = false;
      try {
        const names = Object.keys(options.readPrograms()).sort();
        list.replaceChildren(
          ...names.map((value) => {
            const option = document.createElement("option");
            option.value = option.textContent = value;
            return option;
          })
        );
        if (mode === "load" && names.length === 0) {
          message.textContent = "\u4FDD\u5B58\u6E08\u307F\u306E\u30D7\u30ED\u30B0\u30E9\u30E0\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u30D5\u30A1\u30A4\u30EB\u304B\u3089\u3082\u8AAD\u307F\u8FBC\u3081\u307E\u3059\u3002";
          submit.disabled = true;
        }
      } catch (error) {
        message.textContent = error instanceof Error ? error.message : String(error);
        submit.disabled = true;
      }
      dialog.showModal();
      if (mode === "save") {
        name.focus();
      } else {
        list.focus();
      }
    }
    document.getElementById("screenSave").addEventListener("click", () => open("save"));
    document.getElementById("screenLoad").addEventListener("click", () => open("load"));
    document.getElementById("programCancel").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => options.onClose());
    document.getElementById("programDownload").addEventListener("click", () => options.download());
    document.getElementById("programImport").addEventListener("click", () => {
      dialog.close();
      options.importFile();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void performSubmit();
    });
    async function performSubmit() {
      if (busy || options.isRunning()) {
        return;
      }
      const selected = mode === "save" ? name.value.trim() : list.value;
      if (!selected || /["\r\n]/.test(selected)) {
        message.textContent = "\u540D\u524D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u5F15\u7528\u7B26\u3068\u6539\u884C\u306F\u4F7F\u3048\u307E\u305B\u3093\uFF09\u3002";
        return;
      }
      try {
        if (mode === "save" && Object.hasOwn(options.readPrograms(), selected) && !confirm(`\u300C${selected}\u300D\u3092\u4E0A\u66F8\u304D\u3057\u307E\u3059\u304B\uFF1F`)) {
          return;
        }
        if (mode === "load" && !confirm("\u73FE\u5728\u306E\u30D7\u30ED\u30B0\u30E9\u30E0\u3092\u7F6E\u304D\u63DB\u3048\u307E\u3059\u3002\u8AAD\u307F\u8FBC\u307F\u307E\u3059\u304B\uFF1F")) {
          return;
        }
        busy = true;
        submit.disabled = true;
        await options.submit(
          `${mode === "save" ? "SAVE" : "LOAD"} "${selected}"`
        );
        if (mode === "load") {
          options.onLoaded();
        }
        message.textContent = `\u300C${selected}\u300D\u3092${mode === "save" ? "\u4FDD\u5B58" : "\u8AAD\u307F\u8FBC\u307F"}\u3057\u307E\u3057\u305F\u3002`;
      } catch (error) {
        message.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        busy = false;
        submit.disabled = false;
      }
    }
  }

  // src/graphics.ts
  function createGraphics(context, colors2, currentColor) {
    function selectedColor2(colorIndex) {
      return colors2[(Math.trunc(colorIndex ?? currentColor()) % 8 + 8) % 8];
    }
    function point2(pixelX, pixelY) {
      pixelX = Math.trunc(pixelX);
      pixelY = Math.trunc(pixelY);
      if (pixelX < 0 || pixelX >= 640 || pixelY < 0 || pixelY >= 400) {
        return -1;
      }
      return pixelColor(context.getImageData(pixelX, pixelY, 1, 1).data, 0);
    }
    function pixelColor(data, offset) {
      if (!data[offset + 3]) {
        return 0;
      }
      let best = 0, distance = Infinity;
      colors2.forEach((hex, n) => {
        const rgb = [1, 3, 5].map((p) => parseInt(hex.slice(p, p + 2), 16));
        const colorDistance = rgb.reduce(
          (sum, v, k) => sum + (v - data[offset + k]) ** 2,
          0
        );
        if (colorDistance < distance) {
          distance = colorDistance;
          best = n;
        }
      });
      return best;
    }
    function paint2(pixelX, pixelY, fill, border) {
      pixelX = Math.trunc(pixelX);
      pixelY = Math.trunc(pixelY);
      if (pixelX < 0 || pixelX >= 640 || pixelY < 0 || pixelY >= 400) {
        return;
      }
      border = (Math.trunc(border) % 8 + 8) % 8;
      const image = context.getImageData(0, 0, 640, 400), data = image.data;
      const rgb = [1, 3, 5].map(
        (p) => parseInt(selectedColor2(fill).slice(p, p + 2), 16)
      );
      const seen = new Uint8Array(640 * 400), stack = [pixelY * 640 + pixelX];
      seen[stack[0]] = 1;
      while (stack.length) {
        const pixelIndex = stack.pop(), offset = pixelIndex * 4;
        if (pixelColor(data, offset) === border) {
          continue;
        }
        data[offset] = rgb[0];
        data[offset + 1] = rgb[1];
        data[offset + 2] = rgb[2];
        data[offset + 3] = 255;
        const px = pixelIndex % 640;
        for (const next of [
          px ? pixelIndex - 1 : -1,
          px < 639 ? pixelIndex + 1 : -1,
          pixelIndex - 640,
          pixelIndex + 640
        ]) {
          if (next >= 0 && next < seen.length && !seen[next]) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
      context.putImageData(image, 0, 0);
    }
    return { selectedColor: selectedColor2, point: point2, paint: paint2 };
  }

  // src/storage.ts
  function parsePrograms(serialized) {
    if (serialized === null) {
      return {};
    }
    let value;
    try {
      value = JSON.parse(serialized);
    } catch {
      throw new Error("\u4FDD\u5B58\u30C7\u30FC\u30BF\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002JSON\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059\u3002");
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(
        "\u4FDD\u5B58\u30C7\u30FC\u30BF\u306F\u30D7\u30ED\u30B0\u30E9\u30E0\u540D\u3068\u30B3\u30FC\u30C9\u306E\u4E00\u89A7\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059\u3002"
      );
    }
    const programs = {};
    for (const [name, source] of Object.entries(value)) {
      if (typeof source !== "string") {
        throw new Error(`\u4FDD\u5B58\u30C7\u30FC\u30BF\u300C${name}\u300D\u306E\u30B3\u30FC\u30C9\u304C\u6587\u5B57\u5217\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002`);
      }
      Object.defineProperty(programs, name, {
        value: source,
        enumerable: true,
        writable: true,
        configurable: true
      });
    }
    return programs;
  }
  function readPrograms(storage) {
    return parsePrograms(storage.getItem("n88-programs"));
  }
  function writePrograms(storage, programs) {
    storage.setItem("n88-programs", JSON.stringify(programs));
  }

  // src/syntax.ts
  function splitOutside(source, separator) {
    let quoted = false, depth = 0, start = 0;
    const parts = [];
    for (let i = 0; i < source.length; i++) {
      const character = source[i];
      if (character === '"') {
        quoted = !quoted;
      }
      if (!quoted) {
        if (character === "(") {
          depth++;
        }
        if (character === ")") {
          depth--;
        }
        if (depth === 0 && separator.includes(character)) {
          parts.push(source.slice(start, i));
          parts.push(character);
          start = i + 1;
        }
      }
    }
    parts.push(source.slice(start));
    return parts;
  }
  function argumentsOf(source) {
    return splitOutside(source, ",").filter((_, i) => i % 2 === 0);
  }
  function keywordAt(source, word) {
    let quote = false, depth = 0;
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '"') {
        quote = !quote;
      }
      if (quote) {
        continue;
      }
      if (source[i] === "(") {
        depth++;
      }
      if (source[i] === ")") {
        depth--;
      }
      if (!depth && source.slice(i, i + word.length).toUpperCase() === word && !/[A-Z0-9_$]/i.test(source[i - 1] || "") && !/[A-Z0-9_$]/i.test(source[i + word.length] || "")) {
        return i;
      }
    }
    return -1;
  }

  // src/expression.ts
  function evaluateExpression(source, context) {
    const tokens = tokenize(source);
    let i = 0;
    const peek = () => {
      const token = tokens[i];
      return token?.kind === "symbol" ? token.value : "";
    };
    const take = () => {
      const token = tokens[i++];
      if (!token) {
        throw new BasicError("\u5F0F\u304C\u8DB3\u308A\u307E\u305B\u3093");
      }
      return token;
    };
    const expect = (v) => {
      if (peek() !== v) {
        throw new BasicError(v + " \u304C\u5FC5\u8981\u3067\u3059");
      }
      i++;
    };
    const parsePrimary = () => {
      const token = take();
      if (token.kind !== "symbol") {
        return token.value;
      }
      if (token.value === "(") {
        const v = parseExpression(-2);
        expect(")");
        return v;
      }
      if (["+", "-", "NOT"].includes(token.value)) {
        const v = parseExpression(token.value === "NOT" ? 3 : 7);
        return token.value === "-" ? -Number(v) : token.value === "NOT" ? ~Number(v) : +v;
      }
      if (/^[A-Z_]/.test(token.value)) {
        const args = [];
        if (peek() === "(") {
          i++;
          if (peek() !== ")") {
            do {
              args.push(parseExpression(-2));
              if (peek() !== ",") {
                break;
              }
              i++;
            } while (true);
          }
          expect(")");
          return context.call(token.value, args);
        }
        if (token.value === "INKEY$") {
          return context.io.inkey?.() ?? "";
        }
        if (token.value === "RND") {
          return context.random(1);
        }
        if (token.value === "TIME$") {
          return (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8);
        }
        if (token.value === "DATE$") {
          const d = /* @__PURE__ */ new Date();
          return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0")
          ].join("/");
        }
        if (token.value === "CSRLIN") {
          return context.io.cursor?.().y ?? 0;
        }
        if (token.value === "PI") {
          return Math.PI;
        }
        return context.get(token.value);
      }
      throw new BasicError("\u4E0D\u6B63\u306A\u5F0F\u3067\u3059");
    };
    const precedence = {
      IMP: -2,
      EQV: -1,
      XOR: 0,
      OR: 1,
      AND: 2,
      "=": 3,
      "<>": 3,
      "<": 3,
      ">": 3,
      "<=": 3,
      ">=": 3,
      "+": 4,
      "-": 4,
      MOD: 5,
      "\\": 5,
      "*": 6,
      "/": 6,
      "^": 8
    };
    const parseExpression = (min) => {
      let left = parsePrimary();
      while (peek() in precedence && precedence[peek()] >= min) {
        const operator = peek();
        take();
        const p = precedence[operator], right = parseExpression(operator === "^" ? p : p + 1);
        switch (operator) {
          case "+":
            left = typeof left === "string" || typeof right === "string" ? String(left) + String(right) : left + right;
            break;
          case "-":
            left = Number(left) - Number(right);
            break;
          case "*":
            left = Number(left) * Number(right);
            break;
          case "/":
            if (right === 0) {
              throw new BasicError("0\u3067\u5272\u308B\u3053\u3068\u306F\u3067\u304D\u307E\u305B\u3093");
            }
            left = Number(left) / Number(right);
            break;
          case "\\":
            if (right === 0) {
              throw new BasicError("0\u3067\u5272\u308B\u3053\u3068\u306F\u3067\u304D\u307E\u305B\u3093");
            }
            left = Math.trunc(Number(left) / Number(right));
            break;
          case "MOD":
            if (right === 0) {
              throw new BasicError("0\u3067\u5272\u308B\u3053\u3068\u306F\u3067\u304D\u307E\u305B\u3093");
            }
            left = Number(left) % Number(right);
            break;
          case "^":
            left = Number(left) ** Number(right);
            break;
          case "AND":
            left = Number(left) & Number(right);
            break;
          case "OR":
            left = Number(left) | Number(right);
            break;
          case "XOR":
            left = Number(left) ^ Number(right);
            break;
          case "EQV":
            left = ~(Number(left) ^ Number(right));
            break;
          case "IMP":
            left = ~Number(left) | Number(right);
            break;
          default:
            left = {
              "=": left === right,
              "<>": left !== right,
              "<": left < right,
              ">": left > right,
              "<=": left <= right,
              ">=": left >= right
            }[operator] ? -1 : 0;
        }
      }
      return left;
    };
    const value = parseExpression(-2);
    if (i !== tokens.length) {
      throw new BasicError("\u5F0F\u306E\u672B\u5C3E\u304C\u4E0D\u6B63\u3067\u3059");
    }
    return value;
  }
  function tokenize(source) {
    const tokenPattern = /\s*(?:(&[Hh][0-9A-Fa-f]+|&[Oo][0-7]+|[0-9]+(?:\.[0-9]*)?(?:E[+-]?\d+)?|\.[0-9]+)|("[^"]*")|([A-Za-z_][A-Za-z_0-9]*[$%!#]?)|(<>|<=|>=|[+\-*/\\^=<>(),]))/gy;
    const tokens = [];
    let position = 0;
    while (position < source.length) {
      if (!source.slice(position).trim()) {
        break;
      }
      tokenPattern.lastIndex = position;
      const match = tokenPattern.exec(source);
      if (!match) {
        throw new BasicError("\u5F0F\u3092\u89E3\u91C8\u3067\u304D\u307E\u305B\u3093: " + source.slice(position));
      }
      tokens.push(
        match[1] !== void 0 ? {
          kind: "number",
          value: /^&H/i.test(match[1]) ? parseInt(match[1].slice(2), 16) : /^&O/i.test(match[1]) ? parseInt(match[1].slice(2), 8) : Number(match[1])
        } : match[2] !== void 0 ? { kind: "string", value: match[2].slice(1, -1) } : {
          kind: "symbol",
          value: (match[3] ?? match[4] ?? "").toUpperCase()
        }
      );
      position = tokenPattern.lastIndex;
    }
    return tokens;
  }

  // src/basic.ts
  var Basic = class _Basic {
    constructor(io = {}) {
      this.io = io;
    }
    io;
    stopped = false;
    executing = false;
    vars = {};
    arrays = {};
    seed = 1;
    lastRandom = 0;
    base = 0;
    types = {};
    functions = {};
    fnDepth = 0;
    code = [];
    labels = {};
    labelLines = {};
    data = [];
    dataLines = [];
    dataPos = 0;
    pc = 0;
    programError = null;
    stack = [];
    loops = [];
    whiles = [];
    paceDebt = 0;
    paceTime;
    cancelSleep = null;
    musicAbort = null;
    stop() {
      this.stopped = true;
      this.musicAbort?.abort();
      this.cancelSleep?.();
      if (this.io.cancelInput) {
        this.io.cancelInput();
      }
    }
    typeOf(name) {
      return /[$%!#]$/.test(name) ? name.slice(-1) : this.types[name[0]] || "!";
    }
    get(name) {
      name = name.toUpperCase();
      return this.vars[name] ?? (this.typeOf(name) === "$" ? "" : 0);
    }
    numberExpression(source) {
      const value = this.expression(source);
      if (typeof value !== "number") {
        throw new BasicError("\u6570\u5024\u304C\u5FC5\u8981\u3067\u3059");
      }
      return value;
    }
    expression(source) {
      return evaluateExpression(source, this);
    }
    call(functionName, args) {
      const extra = this.extraFunction(functionName, args);
      if (extra.handled) {
        return extra.value;
      }
      if (functionName === "KEYDOWN") {
        if (args.length !== 1 || typeof args[0] !== "string") {
          throw new BasicError("KEYDOWN\u306B\u306F\u30AD\u30FC\u540D\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
        return this.io.keydown?.(args[0]) ? -1 : 0;
      }
      const funcs = {
        ABS: (x2) => Math.abs(Number(x2)),
        INT: (x2) => Math.floor(Number(x2)),
        FIX: (x2) => Math.trunc(Number(x2)),
        SQR: (x2) => Math.sqrt(Number(x2)),
        SIN: (x2) => Math.sin(Number(x2)),
        COS: (x2) => Math.cos(Number(x2)),
        TAN: (x2) => Math.tan(Number(x2)),
        ATN: (x2) => Math.atan(Number(x2)),
        LOG: (x2) => Math.log(Number(x2)),
        EXP: (x2) => Math.exp(Number(x2)),
        SGN: (x2) => Math.sign(Number(x2)),
        RND: (n) => this.random(n === void 0 ? 1 : Number(n)),
        LEN: (s) => String(s).length,
        VAL: (s) => parseFloat(String(s)) || 0,
        STR$: (x2) => String(x2),
        CHR$: (x2) => String.fromCharCode(Number(x2)),
        ASC: (s) => String(s).charCodeAt(0),
        LEFT$: (s, n) => String(s).slice(0, Number(n)),
        RIGHT$: (s, n) => n === 0 ? "" : String(s).slice(-Number(n)),
        MID$: (s, n, l) => String(s).slice(
          Number(n) - 1,
          l === void 0 ? void 0 : Number(n) - 1 + Number(l)
        ),
        SPACE$: (n) => " ".repeat(Math.max(0, Math.min(1e3, Number(n))))
      };
      if (funcs[functionName]) {
        return funcs[functionName](...args);
      }
      return this.arrayValue(functionName, args);
    }
    random(n = 1) {
      if (n === 0) {
        return this.lastRandom;
      }
      if (n < 0) {
        this.seed = Math.abs(Math.trunc(n)) * 2654435761 >>> 0;
      }
      this.seed = Math.imul(this.seed, 1664525) + 1013904223 >>> 0;
      return this.lastRandom = this.seed / 4294967296;
    }
    extraFunction(functionName, args) {
      const count = (min, max = min) => {
        if (args.length < min || args.length > max) {
          throw new BasicError(functionName + "\u306E\u5F15\u6570\u306E\u6570\u304C\u4E0D\u6B63\u3067\u3059");
        }
      };
      const integer = (v, min, max) => {
        if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
          throw new BasicError(functionName + "\u306E\u5F15\u6570\u304C\u7BC4\u56F2\u5916\u3067\u3059");
        }
        return Math.trunc(v);
      };
      let value;
      switch (functionName) {
        case "INSTR": {
          count(2, 3);
          const start = args.length === 3 ? integer(args[0], 1, 65535) : 1;
          const str = String(args[args.length - 2]), search = String(args.at(-1));
          value = start > str.length ? 0 : str.indexOf(search, start - 1) + 1;
          break;
        }
        case "STRING$":
          count(2);
          value = (typeof args[1] === "number" ? String.fromCharCode(integer(args[1], 0, 65535)) : String(args[1]).slice(0, 1)).repeat(integer(args[0], 0, 65535));
          break;
        case "HEX$":
        case "OCT$":
          count(1);
          value = (integer(args[0], -32768, 65535) & 65535).toString(functionName === "HEX$" ? 16 : 8).toUpperCase();
          break;
        case "CINT":
          count(1);
          value = Math.round(Number(args[0]));
          if (value < -32768 || value > 32767 || !Number.isFinite(value)) {
            throw new BasicError("\u6574\u6570\u306E\u7BC4\u56F2\u5916\u3067\u3059");
          }
          break;
        case "CSNG":
          count(1);
          value = Math.fround(Number(args[0]));
          break;
        case "CDBL":
          count(1);
          value = Number(args[0]);
          break;
        case "POS":
          count(1);
          value = this.io.cursor?.().x ?? 0;
          break;
        case "POINT":
          count(2);
          if (!this.io.point) {
            throw new BasicError("POINT\u3092\u4F7F\u3048\u306A\u3044\u74B0\u5883\u3067\u3059");
          }
          value = this.io.point(Number(args[0]), Number(args[1]));
          break;
        case "SPC":
          count(1);
          value = " ".repeat(integer(args[0], 0, 1e3));
          break;
        case "TAB": {
          count(1);
          const column = integer(args[0], 0, 79), current = this.io.cursor?.().x ?? 0;
          value = (column < current ? "\n" : "") + " ".repeat(column < current ? column : column - current);
          break;
        }
        default: {
          if (!functionName.startsWith("FN")) {
            return { handled: false };
          }
          const fn = this.functions[functionName];
          if (!fn) {
            throw new BasicError("\u95A2\u6570\u304C\u5B9A\u7FA9\u3055\u308C\u3066\u3044\u307E\u305B\u3093: " + functionName);
          }
          count(fn.params.length);
          if (this.fnDepth >= 64) {
            throw new BasicError("\u95A2\u6570\u306E\u547C\u3073\u51FA\u3057\u304C\u6DF1\u3059\u304E\u307E\u3059");
          }
          const previous = fn.params.map((p) => ({
            parameterName: p,
            exists: Object.hasOwn(this.vars, p),
            value: this.vars[p]
          }));
          this.fnDepth++;
          try {
            fn.params.forEach((p, i) => this.assign(p, args[i]));
            value = this.expression(fn.body);
          } finally {
            for (const p of previous) {
              if (p.exists && p.value !== void 0) {
                this.vars[p.parameterName] = p.value;
              } else {
                delete this.vars[p.parameterName];
              }
            }
            this.fnDepth--;
          }
        }
      }
      return { handled: true, value };
    }
    extraStatement(statementSource) {
      let match;
      if (match = statementSource.match(
        /^ON\s+(.+?)\s+GO(SUB|TO)\s+((?:\d+|\*[A-Z][A-Z0-9_]*)(?:\s*,\s*(?:\d+|\*[A-Z][A-Z0-9_]*))*)$/i
      )) {
        const n = Math.trunc(this.numberExpression(match[1])), targets = match[3].split(",").map((v) => v.trim());
        if (n < 0 || n > 255) {
          throw new BasicError("ON\u306E\u9078\u629E\u756A\u53F7\u306F0\u301C255\u3067\u3059");
        }
        if (targets.some((v) => !/^(?:\d+|\*[A-Z][A-Z0-9_]*)$/i.test(v))) {
          throw new BasicError("\u884C\u756A\u53F7\u306E\u4E00\u89A7\u304C\u4E0D\u6B63\u3067\u3059");
        }
        if (n > 0 && n <= targets.length) {
          if (match[2].toUpperCase() === "SUB") {
            this.stack.push(this.pc);
          }
          this.jump(targets[n - 1]);
        }
        return true;
      }
      if (match = statementSource.match(/^WHILE\s+(.+)$/i)) {
        const start = this.pc - 1;
        if (this.expression(match[1])) {
          if (this.whiles.at(-1) !== start) {
            this.whiles.push(start);
          }
        } else {
          let depth = 1;
          while (this.pc < this.code.length && depth) {
            const text = this.code[this.pc++].text;
            if (/^WHILE\b/i.test(text)) {
              depth++;
            }
            if (/^WEND$/i.test(text)) {
              depth--;
            }
          }
          if (depth) {
            throw new BasicError("WEND\u304C\u3042\u308A\u307E\u305B\u3093");
          }
          if (this.whiles.at(-1) === start) {
            this.whiles.pop();
          }
        }
        return true;
      }
      if (/^WEND$/i.test(statementSource)) {
        if (!this.whiles.length) {
          throw new BasicError("WHILE\u306E\u306A\u3044WEND\u3067\u3059");
        }
        this.pc = this.whiles.at(-1);
        return true;
      }
      if (match = statementSource.match(
        /^DEF\s+(FN[A-Z][A-Z0-9]*[$%!#]?)\s*\(([^)]*)\)\s*=\s*(.+)$/i
      )) {
        const params = match[2].trim() ? match[2].split(",").map((v) => v.trim().toUpperCase()) : [];
        if (params.some((p) => !/^([A-Z][A-Z0-9]*[$%!#]?)$/.test(p)) || new Set(params).size !== params.length) {
          throw new BasicError("DEF FN\u306E\u5F15\u6570\u304C\u4E0D\u6B63\u3067\u3059");
        }
        this.functions[match[1].toUpperCase()] = { params, body: match[3] };
        return true;
      }
      if (match = statementSource.match(/^DEF(INT|SNG|DBL|STR)\s+(.+)$/i)) {
        const type = { INT: "%", SNG: "!", DBL: "#", STR: "$" }[match[1].toUpperCase()];
        for (const part of match[2].toUpperCase().split(",")) {
          const range = part.trim().match(/^([A-Z])(?:-([A-Z]))?$/);
          if (!range) {
            throw new BasicError("\u578B\u5BA3\u8A00\u306E\u7BC4\u56F2\u304C\u4E0D\u6B63\u3067\u3059");
          }
          const end = (range[2] || range[1]).charCodeAt(0);
          if (end < range[1].charCodeAt(0)) {
            throw new BasicError("\u578B\u5BA3\u8A00\u306E\u7BC4\u56F2\u304C\u4E0D\u6B63\u3067\u3059");
          }
          for (let c = range[1].charCodeAt(0); c <= end; c++) {
            this.types[String.fromCharCode(c)] = type;
          }
        }
        return true;
      }
      if (match = statementSource.match(/^OPTION\s+BASE\s+([01])$/i)) {
        if (Object.keys(this.arrays).length) {
          throw new BasicError("OPTION BASE\u306FDIM\u3088\u308A\u524D\u306B\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
        this.base = Number(match[1]);
        return true;
      }
      if (match = statementSource.match(/^ERASE\s+(.+)$/i)) {
        for (const raw of match[1].split(",")) {
          const name = raw.trim().toUpperCase();
          if (!this.arrays[name]) {
            throw new BasicError("\u914D\u5217\u304C\u3042\u308A\u307E\u305B\u3093: " + name);
          }
          delete this.arrays[name];
          for (const key of Object.keys(this.vars)) {
            if (key.startsWith(name + "(")) {
              delete this.vars[key];
            }
          }
        }
        return true;
      }
      if (match = statementSource.match(/^SWAP\s+(.+)$/i)) {
        const targets = argumentsOf(match[1]);
        if (targets.length !== 2) {
          throw new BasicError("SWAP\u306B\u306F\u5909\u6570\u30922\u3064\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
        if (targets.some(
          (v) => !/^\s*[A-Z][A-Z0-9]*[$%!#]?(?:\(.*\))?\s*$/i.test(v)
        )) {
          throw new BasicError("SWAP\u306B\u306F\u5909\u6570\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
        const values = targets.map((v) => this.expression(v));
        if (typeof values[0] !== typeof values[1]) {
          throw new BasicError("SWAP\u306E\u578B\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093");
        }
        this.assign(targets[0], values[1]);
        this.assign(targets[1], values[0]);
        return true;
      }
      if (match = statementSource.match(/^MID\$\s*\((.*)\)\s*=\s*(.+)$/i)) {
        const args = argumentsOf(match[1]);
        if (args.length < 2 || args.length > 3) {
          throw new BasicError("MID$\u4EE3\u5165\u306E\u66F8\u5F0F\u304C\u4E0D\u6B63\u3067\u3059");
        }
        const original = this.expression(args[0]), replacement = this.expression(match[2]);
        const start = Math.trunc(this.numberExpression(args[1])) - 1, length = args[2] === void 0 ? String(replacement).length : Math.trunc(this.numberExpression(args[2]));
        if (typeof original !== "string" || typeof replacement !== "string" || start < 0 || length < 0) {
          throw new BasicError("MID$\u4EE3\u5165\u306E\u5F15\u6570\u304C\u4E0D\u6B63\u3067\u3059");
        }
        const used = Math.min(
          length,
          replacement.length,
          Math.max(0, original.length - start)
        );
        this.assign(
          args[0],
          original.slice(0, start) + replacement.slice(0, used) + original.slice(start + used)
        );
        return true;
      }
      if (match = statementSource.match(
        /^LINE\s+INPUT\s+(?:"([^"]*)"\s*;\s*)?(.+)$/i
      )) {
        return (async () => {
          const value = await this.io.input?.(match[1] || "? ");
          if (!this.stopped) {
            this.assign(match[2], value ?? "");
          }
          return true;
        })();
      }
      if (match = statementSource.match(/^RANDOMIZE(?:\s+(.+))?$/i)) {
        this.seed = (match[1] ? Math.trunc(this.numberExpression(match[1])) : Date.now()) >>> 0;
        return true;
      }
      if (/^CLEAR$/i.test(statementSource)) {
        this.resetVariables();
        return true;
      }
      if (match = statementSource.match(/^PLAY\s+(.+)$/i)) {
        const args = argumentsOf(match[1]);
        if (args.length !== 1) {
          throw new BasicError("PLAY\u306F\u5358\u97F3\u306E\u6587\u5B57\u52171\u3064\u306B\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u3059");
        }
        const score = this.expression(args[0]);
        if (typeof score !== "string") {
          throw new BasicError("PLAY\u306B\u306F\u6587\u5B57\u5217\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
        const notes = parseMusic(score);
        if (!this.io.play) {
          throw new BasicError("PLAY\u3092\u4F7F\u3048\u306A\u3044\u74B0\u5883\u3067\u3059");
        }
        const controller = new AbortController();
        this.musicAbort = controller;
        return this.io.play(notes, controller.signal).then(() => true).finally(() => {
          if (this.musicAbort === controller) {
            this.musicAbort = null;
          }
        });
      }
      if (/^BEEP$/i.test(statementSource)) {
        if (!this.io.beep) {
          throw new BasicError("BEEP\u3092\u4F7F\u3048\u306A\u3044\u74B0\u5883\u3067\u3059");
        }
        this.io.beep();
        return true;
      }
      if (match = statementSource.match(/^PRESET\s*\((.*)\)(?:\s*,\s*(.+))?$/i)) {
        const a = argumentsOf(match[1]).map((v) => this.expression(v));
        if (a.length !== 2) {
          throw new BasicError("\u5EA7\u6A19\u30922\u3064\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
        this.io.pset?.(
          Number(a[0]),
          Number(a[1]),
          match[2] ? this.numberExpression(match[2]) : 0
        );
        return true;
      }
      if (match = statementSource.match(/^PAINT\s*\(([^)]*)\)\s*,\s*(.+)$/i)) {
        const xy = argumentsOf(match[1]).map((v) => this.expression(v)), a = argumentsOf(match[2]).map((v) => this.expression(v));
        if (xy.length !== 2 || a.length < 1 || a.length > 2) {
          throw new BasicError("PAINT\u306E\u66F8\u5F0F\u304C\u4E0D\u6B63\u3067\u3059");
        }
        if (!this.io.paint) {
          throw new BasicError("PAINT\u3092\u4F7F\u3048\u306A\u3044\u74B0\u5883\u3067\u3059");
        }
        this.io.paint(
          Number(xy[0]),
          Number(xy[1]),
          Number(a[0]),
          Number(a[1] ?? a[0])
        );
        return true;
      }
      if (match = statementSource.match(/^NEXT\s+(.+,.+)$/i)) {
        return (async () => {
          for (const name of match[1].split(",")) {
            const pc = this.pc;
            await this.statement("NEXT " + name.trim());
            if (this.pc !== pc || this.stopped) {
              break;
            }
          }
          return true;
        })();
      }
      if (match = statementSource.match(/^PRINT\s+USING\s+(.+)$/i)) {
        const parts = splitOutside(match[1], ";");
        if (parts.length < 3) {
          throw new BasicError("PRINT USING\u306B\u306F\u66F8\u5F0F\u3068\u5024\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
        const format = this.expression(parts[0]);
        if (typeof format !== "string") {
          throw new BasicError("\u66F8\u5F0F\u306F\u6587\u5B57\u5217\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
        const values = splitOutside(parts.slice(2).join(""), ";,").filter((_, i) => i % 2 === 0).filter((v) => v.trim()).map((v) => this.expression(v));
        const fields = [
          ...format.matchAll(/!|&|\\ *\\|[+]?#+(?:,#+)*(?:\.#+)?[+-]?/g)
        ];
        if (!fields.length || !values.length) {
          throw new BasicError("PRINT USING\u306E\u66F8\u5F0F\u307E\u305F\u306F\u5024\u304C\u3042\u308A\u307E\u305B\u3093");
        }
        let index = 0;
        while (index < values.length) {
          let at = 0, out = "";
          for (const f of fields) {
            out += format.slice(at, f.index);
            if (index >= values.length) {
              at = f.index;
              break;
            }
            const v = values[index++], field = f[0];
            if (field === "!" || field === "&" || field.startsWith("\\")) {
              if (typeof v !== "string") {
                throw new BasicError("\u6587\u5B57\u5217\u304C\u5FC5\u8981\u3067\u3059");
              }
              const length = field === "!" ? 1 : field === "&" ? v.length : field.length;
              out += v.slice(0, length).padEnd(length, " ");
            } else {
              if (typeof v !== "number") {
                throw new BasicError("\u6570\u5024\u304C\u5FC5\u8981\u3067\u3059");
              }
              const digits = field.match(/\.(#+)/)?.[1].length || 0;
              let text = Math.abs(v).toFixed(digits);
              if (field.includes(",")) {
                const p = text.split(".");
                p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                text = p.join(".");
              }
              if (field.endsWith("-")) {
                text += v < 0 ? "-" : " ";
              } else if (field.endsWith("+")) {
                text += v < 0 ? "-" : "+";
              } else {
                text = (v < 0 ? "-" : field.startsWith("+") ? "+" : "") + text;
              }
              out += text.length > field.length ? "%" + text : text.padStart(field.length, " ");
            }
            at = f.index + field.length;
          }
          out += format.slice(at);
          this.io.print?.(out);
        }
        if (!/[;,]\s*$/.test(statementSource)) {
          this.io.print?.("\n");
        }
        return true;
      }
      return false;
    }
    arrayKey(name, indices) {
      const dims = this.arrays[name];
      if (!dims) {
        throw new BasicError("\u914D\u5217\u304C\u5B9A\u7FA9\u3055\u308C\u3066\u3044\u307E\u305B\u3093: " + name);
      }
      if (indices.length !== dims.length || indices.some(
        (n, i) => !Number.isInteger(n) || typeof n !== "number" || n < this.base || n > dims[i]
      )) {
        throw new BasicError("\u914D\u5217\u306E\u6DFB\u5B57\u304C\u7BC4\u56F2\u5916\u3067\u3059");
      }
      return name + "(" + indices.join(",") + ")";
    }
    arrayValue(name, a) {
      return this.vars[this.arrayKey(name, a)] ?? (this.typeOf(name) === "$" ? "" : 0);
    }
    assign(target, value) {
      const m = target.trim().toUpperCase().match(/^([A-Z_][A-Z_0-9]*[$%!#]?)(?:\((.*)\))?$/);
      if (!m) {
        throw new BasicError("\u5909\u6570\u540D\u304C\u4E0D\u6B63\u3067\u3059: " + target);
      }
      let name = m[1];
      if (m[2] !== void 0) {
        name = this.arrayKey(
          name,
          splitOutside(m[2], ",").filter((_, i) => i % 2 === 0).map((s) => this.expression(s))
        );
      }
      if (this.typeOf(m[1]) === "$") {
        if (typeof value !== "string") {
          throw new BasicError("\u6587\u5B57\u5217\u304C\u5FC5\u8981\u3067\u3059");
        }
      } else {
        if (typeof value !== "number") {
          throw new BasicError("\u6570\u5024\u304C\u5FC5\u8981\u3067\u3059");
        }
        if (this.typeOf(m[1]) === "%") {
          value = Math.round(value);
        }
      }
      this.vars[name] = value;
    }
    compile(source) {
      const lines = [], seen = /* @__PURE__ */ new Set();
      for (const raw of source.split(/\r?\n/)) {
        if (!raw.trim()) {
          continue;
        }
        const m = raw.match(/^\s*(\d+)\s*(.*)$/);
        if (!m) {
          throw new BasicError("\u5404\u884C\u306E\u5148\u982D\u306B\u884C\u756A\u53F7\u3092\u4ED8\u3051\u3066\u304F\u3060\u3055\u3044");
        }
        const number = Number(m[1]);
        if (seen.has(number)) {
          throw new BasicError("\u884C\u756A\u53F7\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059: " + number);
        }
        seen.add(number);
        lines.push({ number, text: m[2] });
      }
      lines.sort((a, b) => a.number - b.number);
      this.code = [];
      this.labels = {};
      this.labelLines = {};
      this.data = [];
      this.dataLines = [];
      for (const l of lines) {
        this.labels[l.number] = this.code.length;
        const parts = splitOutside(l.text, ":").filter((_, i) => i % 2 === 0);
        for (let n = 0; n < parts.length; n++) {
          let s = parts[n].trim();
          if (/^IF\b/i.test(s) || /^REM\b/i.test(s) || s.startsWith("'")) {
            s = parts.slice(n).join(":").trim();
            n = parts.length;
          }
          if (s.startsWith("*")) {
            const label = s.match(/^\*([A-Z][A-Z0-9_]*)$/i);
            if (!label) {
              throw new BasicError("Syntax error in " + l.number, "SYNTAX");
            }
            const key = "*" + label[1].toUpperCase();
            if (Object.hasOwn(this.labels, key)) {
              throw new BasicError("\u30E9\u30D9\u30EB\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059: " + key);
            }
            this.labels[key] = this.code.length;
            this.labelLines[key] = l.number;
            s = "";
          }
          this.code.push({ number: l.number, text: s });
          if (/^DATA\b/i.test(s)) {
            this.dataLines.push({ number: l.number, index: this.data.length });
            for (const value of splitOutside(
              s.replace(/^DATA\s*/i, ""),
              ","
            ).filter((_, i) => i % 2 === 0)) {
              const v = value.trim();
              this.data.push(
                /^".*"$/.test(v) ? v.slice(1, -1) : v !== "" && Number.isFinite(Number(v)) ? Number(v) : v
              );
            }
          }
        }
      }
    }
    jump(n) {
      if (this.programError) {
        throw this.programError;
      }
      const key = String(n).trim().toUpperCase(), dest = this.labels[key.startsWith("*") ? key : Number(key)];
      if (dest === void 0) {
        throw new BasicError(
          (key.startsWith("*") ? "\u30E9\u30D9\u30EB\u304C\u3042\u308A\u307E\u305B\u3093: " : "\u884C\u756A\u53F7\u304C\u3042\u308A\u307E\u305B\u3093: ") + n
        );
      }
      this.pc = dest;
    }
    sleep(ms) {
      return new Promise((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          this.cancelSleep = null;
          resolve();
        };
        const timer = setTimeout(finish, ms);
        this.cancelSleep = finish;
      });
    }
    resetVariables() {
      this.vars = {};
      this.arrays = {};
      this.dataPos = 0;
      this.base = 0;
      this.types = {};
      this.functions = {};
    }
    async run(source, start) {
      if (this.executing) {
        throw new BasicError("\u5B9F\u884C\u4E2D\u3067\u3059");
      }
      this.resetVariables();
      this.programError = null;
      this.compile(source);
      this.pc = 0;
      if (start !== void 0) {
        this.jump(start);
      }
      return this.execute();
    }
    async immediate(command, source = "") {
      if (this.executing) {
        throw new BasicError("\u5B9F\u884C\u4E2D\u3067\u3059");
      }
      const direct = new _Basic();
      direct.compile("0 " + command);
      this.programError = null;
      try {
        this.compile(source);
      } catch (error) {
        this.compile("");
        this.programError = error;
      }
      const prefix = direct.code.map((line) => ({
        number: null,
        text: line.text
      }));
      prefix.push({ number: null, text: "END" });
      for (const [label, destination] of Object.entries(this.labels)) {
        if (destination !== void 0) {
          this.labels[label] = destination + prefix.length;
        }
      }
      this.code = prefix.concat(this.code);
      this.pc = 0;
      if (this.dataPos === void 0) {
        this.dataPos = 0;
      }
      return this.execute();
    }
    pace(text) {
      const speed = this.io.speed?.() ?? 0;
      const now = (this.io.now || (() => performance.now()))();
      if (!(speed > 0)) {
        this.paceDebt = 0;
        this.paceTime = now;
        return null;
      }
      const elapsed = Math.max(0, now - (this.paceTime ?? now));
      this.paceTime = now;
      const cost = /^(?:REM\b|'|DATA\b)/i.test(text) ? 0 : /^PAINT\b/i.test(text) ? 16 : /^(?:LINE(?!\s+INPUT)|CIRCLE)\b/i.test(text) ? 8 : /^(?:PRINT\b|\?)/i.test(text) ? 2 : 1;
      this.paceDebt = Math.max(0, (this.paceDebt || 0) - elapsed) + cost / speed;
      if (this.paceDebt < 12) {
        return null;
      }
      return this.sleep(Math.min(50, this.paceDebt));
    }
    async execute() {
      this.executing = true;
      this.stopped = false;
      this.stack = [];
      this.loops = [];
      this.whiles = [];
      let ticks = 0;
      this.paceDebt = 0;
      this.paceTime = void 0;
      try {
        while (this.pc < this.code.length && !this.stopped) {
          const line = this.code[this.pc++];
          try {
            await this.statement(line.text);
          } catch (e) {
            if (this.stopped) {
              break;
            }
            if (e instanceof BasicError && e.code === "SYNTAX") {
              throw new BasicError(
                "Syntax error" + (line.number === null ? "" : " in " + line.number),
                "SYNTAX"
              );
            }
            throw new BasicError(
              (line.number === null ? "" : line.number + "\u884C: ") + (e instanceof Error ? e.message : String(e))
            );
          }
          if (++ticks % 200 === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        return { stopped: this.stopped };
      } finally {
        this.executing = false;
      }
    }
    async statement(statementSource) {
      statementSource = statementSource.trim();
      const wait = this.pace(statementSource);
      if (wait) {
        await wait;
        if (this.stopped) {
          return;
        }
      }
      if (!statementSource || /^REM\b|^'|^DATA\b/i.test(statementSource)) {
        return;
      }
      let match;
      const extra = this.extraStatement(statementSource);
      if (extra) {
        if (typeof extra !== "boolean") {
          await extra;
        }
        return;
      }
      if (match = statementSource.match(/^IF\s+(.+?)\s+THEN\s+(.+)$/i)) {
        const at = keywordAt(match[2], "ELSE");
        const branches = at < 0 ? [match[2]] : [match[2].slice(0, at), match[2].slice(at + 4)];
        const branch = this.expression(match[1]) ? branches[0] : branches[1];
        if (branch) {
          if (/^(?:\d+|\*[A-Z][A-Z0-9_]*)$/i.test(branch.trim())) {
            this.jump(branch.trim());
          } else {
            for (const part of splitOutside(branch, ":").filter(
              (_, i) => i % 2 === 0
            )) {
              const pc = this.pc;
              await this.statement(part);
              if (this.pc !== pc || this.stopped) {
                break;
              }
            }
          }
        }
        return;
      }
      if (match = statementSource.match(/^(?:PRINT\b|\?)(.*)$/i)) {
        const parts = splitOutside(match[1].trim(), ";,");
        for (let i = 0; i < parts.length; i++) {
          if (i % 2) {
            if (parts[i] === ",") {
              this.io.print?.("        ");
            }
          } else if (parts[i].trim()) {
            this.io.print?.(String(this.expression(parts[i])));
          }
        }
        if (!/[;,]\s*$/.test(match[1])) {
          this.io.print?.("\n");
        }
        return;
      }
      if (match = statementSource.match(/^SLEEP\s+(.+)$/i)) {
        const ms = this.expression(match[1]);
        if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0 || ms > 6e4) {
          throw new BasicError("SLEEP\u306F0\u301C60000\u30DF\u30EA\u79D2\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
        await this.sleep(ms);
        return;
      }
      if (match = statementSource.match(/^CLS(?:\s+(.+))?$/i)) {
        const mode = match[1] === void 0 ? 1 : this.expression(match[1]);
        if (typeof mode !== "number" || !Number.isInteger(mode) || mode < 1 || mode > 3) {
          throw new BasicError("CLS\u306E\u5F15\u6570\u306F1\u30FB2\u30FB3\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
        this.io.clear?.(mode);
        return;
      }
      if (/^(END|STOP)$/i.test(statementSource)) {
        this.pc = this.code.length;
        return;
      }
      if (match = statementSource.match(/^GOTO\s+(\d+|\*[A-Z][A-Z0-9_]*)$/i)) {
        this.jump(match[1]);
        return;
      }
      if (match = statementSource.match(/^GOSUB\s+(\d+|\*[A-Z][A-Z0-9_]*)$/i)) {
        this.stack.push(this.pc);
        this.jump(match[1]);
        return;
      }
      if (/^RETURN$/i.test(statementSource)) {
        if (!this.stack.length) {
          throw new BasicError("GOSUB\u306E\u306A\u3044RETURN\u3067\u3059");
        }
        this.pc = this.stack.pop();
        return;
      }
      if (match = statementSource.match(
        /^FOR\s+([A-Z]\w*[%!#]?)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i
      )) {
        const name = match[1].toUpperCase(), start = this.numberExpression(match[2]), end = this.numberExpression(match[3]), step = match[4] ? this.numberExpression(match[4]) : 1;
        if (!step) {
          throw new BasicError("STEP\u306F0\u306B\u3067\u304D\u307E\u305B\u3093");
        }
        this.assign(name, start);
        if (step > 0 ? start > end : start < end) {
          let depth = 1;
          while (this.pc < this.code.length && depth) {
            const t2 = this.code[this.pc++].text;
            if (/^FOR\b/i.test(t2)) {
              depth++;
            }
            if (/^NEXT\b/i.test(t2)) {
              const names = t2.replace(/^NEXT\s*/i, "").split(",");
              for (let i = 0; i < names.length; i++) {
                depth--;
                if (!depth) {
                  if (i + 1 < names.length) {
                    await this.statement("NEXT " + names.slice(i + 1).join(","));
                  }
                  break;
                }
              }
            }
          }
          if (depth) {
            throw new BasicError("NEXT\u304C\u3042\u308A\u307E\u305B\u3093");
          }
        } else {
          this.loops.push({ name, end, step, pc: this.pc });
        }
        return;
      }
      if (match = statementSource.match(/^NEXT(?:\s+([A-Z]\w*[%!#]?))?$/i)) {
        const loop = this.loops.at(-1);
        if (!loop || match[1] && match[1].toUpperCase() !== loop.name) {
          throw new BasicError("FOR\u3068NEXT\u304C\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u305B\u3093");
        }
        this.assign(loop.name, Number(this.get(loop.name)) + loop.step);
        const v = Number(this.get(loop.name));
        if (loop.step > 0 ? v <= loop.end : v >= loop.end) {
          this.pc = loop.pc;
        } else {
          this.loops.pop();
        }
        return;
      }
      if (match = statementSource.match(/^INPUT\s+(?:"([^"]*)"\s*;\s*)?(.+)$/i)) {
        const targets = splitOutside(match[2], ",").filter((_, i) => i % 2 === 0);
        const answer = await this.io.input?.(match[1] || "? ");
        if (this.stopped) {
          return;
        }
        const values = splitOutside(answer || "", ",").filter(
          (_, i) => i % 2 === 0
        );
        if (values.length !== targets.length) {
          throw new BasicError("\u5165\u529B\u5024\u306E\u6570\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093");
        }
        targets.forEach((t2, i) => {
          const v = values[i].trim();
          if (this.typeOf(t2.trim().split("(")[0].toUpperCase()) === "$") {
            this.assign(t2, v.replace(/^"(.*)"$/, "$1"));
          } else {
            if (v === "" || !Number.isFinite(Number(v))) {
              throw new BasicError("\u6570\u5024\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
            }
            this.assign(t2, Number(v));
          }
        });
        return;
      }
      if (match = statementSource.match(/^DIM\s+(.+)$/i)) {
        for (const p of splitOutside(match[1], ",").filter(
          (_, i) => i % 2 === 0
        )) {
          const d = p.match(/^\s*([A-Z]\w*[$%!#]?)\((.*)\)\s*$/i);
          if (!d) {
            throw new BasicError("DIM\u306E\u66F8\u5F0F\u304C\u4E0D\u6B63\u3067\u3059");
          }
          const dims = d[2].split(",").map((x2) => this.numberExpression(x2));
          if (dims.some((x2) => !Number.isInteger(x2) || x2 < this.base)) {
            throw new BasicError("\u914D\u5217\u306E\u5927\u304D\u3055\u304C\u4E0D\u6B63\u3067\u3059");
          }
          if (this.arrays[d[1].toUpperCase()]) {
            throw new BasicError("\u914D\u5217\u306F\u3059\u3067\u306B\u5B9A\u7FA9\u3055\u308C\u3066\u3044\u307E\u3059");
          }
          this.arrays[d[1].toUpperCase()] = dims;
        }
        return;
      }
      if (match = statementSource.match(/^READ\s+(.+)$/i)) {
        if (this.programError) {
          throw this.programError;
        }
        for (const t2 of splitOutside(match[1], ",").filter(
          (_, i) => i % 2 === 0
        )) {
          if (this.dataPos >= this.data.length) {
            throw new BasicError("DATA\u304C\u8DB3\u308A\u307E\u305B\u3093");
          }
          this.assign(t2, this.data[this.dataPos++]);
        }
        return;
      }
      if (match = statementSource.match(
        /^RESTORE(?:\s+(\d+|\*[A-Z][A-Z0-9_]*))?$/i
      )) {
        if (this.programError) {
          throw this.programError;
        }
        let line = match[1];
        if (typeof line === "string" && line.startsWith("*")) {
          const key = line.toUpperCase();
          line = this.labelLines[key];
          if (line === void 0) {
            throw new BasicError("\u30E9\u30D9\u30EB\u304C\u3042\u308A\u307E\u305B\u3093: " + key);
          }
        }
        this.dataPos = line === void 0 ? 0 : this.dataLines.find((l) => l.number >= Number(line))?.index ?? this.data.length;
        return;
      }
      if (match = statementSource.match(/^COLOR\s+(.+)$/i)) {
        this.io.color?.(this.numberExpression(argumentsOf(match[1])[0]));
        return;
      }
      if (match = statementSource.match(/^LOCATE\s+(.+)$/i)) {
        const a = argumentsOf(match[1]).map((x2) => this.numberExpression(x2));
        this.io.locate?.(a[0], a[1]);
        return;
      }
      if (match = statementSource.match(
        /^PSET\s*\((.+?),(.+?)\)(?:\s*,\s*(.+))?$/i
      )) {
        this.io.pset?.(
          this.numberExpression(match[1]),
          this.numberExpression(match[2]),
          match[3] ? this.numberExpression(match[3]) : void 0
        );
        return;
      }
      if (match = statementSource.match(
        /^LINE\s*\((.+?),(.+?)\)\s*-\s*\((.+?),(.+?)\)(?:\s*,\s*([^,]+))?(?:\s*,\s*(BF|B))?$/i
      )) {
        this.io.line?.(
          this.numberExpression(match[1]),
          this.numberExpression(match[2]),
          this.numberExpression(match[3]),
          this.numberExpression(match[4]),
          match[5] ? this.numberExpression(match[5]) : void 0,
          match[6]?.toUpperCase()
        );
        return;
      }
      if (match = statementSource.match(
        /^CIRCLE\s*\((.+?),(.+?)\)\s*,\s*([^,]+)(?:\s*,\s*(.+))?$/i
      )) {
        this.io.circle?.(
          this.numberExpression(match[1]),
          this.numberExpression(match[2]),
          this.numberExpression(match[3]),
          match[4] ? this.numberExpression(match[4]) : void 0
        );
        return;
      }
      if (/^SCREEN\s+[0-9, ]+$/i.test(statementSource) || /^WIDTH\s+[0-9, ]+$/i.test(statementSource)) {
        return;
      }
      if (match = statementSource.match(
        /^(?:LET\s+)?([A-Z_][A-Z_0-9]*[$%!#]?(?:\(.*?\))?)\s*=\s*(.+)$/i
      )) {
        this.assign(match[1], this.expression(match[2]));
        return;
      }
      throw new BasicError("Syntax error", "SYNTAX");
    }
  };

  // src/program-lines.ts
  function parseProgramLines(source) {
    const lines = /* @__PURE__ */ new Map();
    for (const raw of source.split(/\r?\n/)) {
      if (!raw.trim()) {
        continue;
      }
      const match = raw.match(/^\s*(\d+)\s*(.*)$/);
      if (!match || !Number.isSafeInteger(Number(match[1]))) {
        throw new Error("\u30A8\u30C7\u30A3\u30BF\u306E\u884C\u756A\u53F7\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044");
      }
      const lineNumber = Number(match[1]);
      if (lines.has(lineNumber)) {
        throw new Error("\u884C\u756A\u53F7\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059: " + lineNumber);
      }
      lines.set(lineNumber, match[2]);
    }
    return [...lines].sort((a, b) => a[0] - b[0]);
  }

  // src/session.ts
  var Session = class {
    constructor(basic2, io) {
      this.basic = basic2;
      this.io = io;
    }
    basic;
    io;
    programs = {};
    lines() {
      return parseProgramLines(this.io.getSource());
    }
    renumber(args) {
      const parts = args.split(",").map((v) => v.trim());
      if (parts.length > 3 || parts.some((v) => v && !/^\d+$/.test(v))) {
        throw new Error(
          "RENUM [\u65B0\u884C\u756A\u53F7],[\u65E7\u958B\u59CB\u884C\u756A\u53F7],[\u5897\u5206] \u306E\u66F8\u5F0F\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044"
        );
      }
      const [start, from, step] = [0, 1, 2].map(
        (i) => parts[i] ? Number(parts[i]) : [10, 0, 10][i]
      );
      if (![start, from, step].every(Number.isSafeInteger) || start < 1 || from < 0 || step < 1 || Math.max(start, from, step) > 65529) {
        throw new Error("RENUM\u306E\u884C\u756A\u53F7\u30FB\u5897\u5206\u304C\u7BC4\u56F2\u5916\u3067\u3059");
      }
      const lines = this.lines(), map = /* @__PURE__ */ new Map();
      let next = start, previous = -1;
      for (const [n] of lines) {
        const updated = n < from ? n : next;
        if (n >= from) {
          next += step;
        }
        if (updated <= previous || updated > 65529) {
          throw new Error("RENUM\u3067\u884C\u756A\u53F7\u304C\u91CD\u8907\u30FB\u9006\u8EE2\u3059\u308B\u304B65529\u3092\u8D85\u3048\u307E\u3059");
        }
        previous = updated;
        map.set(n, updated);
      }
      const rewrite = (text) => {
        const tokens = text.match(
          /"[^"]*"|'[^\n]*|[A-Za-z_][A-Za-z_0-9]*[$%!#]?|\d+(?:\.\d*)?|\s+|./g
        ) || [];
        let data = false, expect = false, list = false;
        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i], upper = token.toUpperCase();
          if (/^\s+$/.test(token)) {
            continue;
          }
          if (token.startsWith("'")) {
            break;
          }
          if (token === ":") {
            data = false;
            expect = false;
            list = false;
            continue;
          }
          if (data) {
            continue;
          }
          if (upper === "REM") {
            break;
          }
          if (upper === "DATA") {
            data = true;
            expect = false;
            list = false;
            continue;
          }
          if (expect && /^\d+$/.test(token)) {
            const old = Number(token);
            if (!map.has(old)) {
              throw new Error("RENUM: \u53C2\u7167\u5148\u306E\u884C\u756A\u53F7\u304C\u3042\u308A\u307E\u305B\u3093: " + old);
            }
            tokens[i] = String(map.get(old));
            expect = false;
            continue;
          }
          if (token === "," && list) {
            expect = true;
            continue;
          }
          expect = false;
          list = false;
          if ([
            "GOTO",
            "GOSUB",
            "THEN",
            "ELSE",
            "RESTORE",
            "RUN",
            "RESUME",
            "RETURN"
          ].includes(upper)) {
            expect = true;
            list = upper === "GOTO" || upper === "GOSUB";
          }
        }
        return tokens.join("");
      };
      const source = lines.map(([n, text]) => map.get(n) + " " + rewrite(text)).join("\n");
      this.io.setSource(source);
      this.basic.resetVariables();
      return { kind: "edit" };
    }
    async submit(command) {
      if (this.basic.executing) {
        throw new Error("\u5B9F\u884C\u4E2D\u3067\u3059\u3002\u5148\u306B\u505C\u6B62\u3057\u3066\u304F\u3060\u3055\u3044");
      }
      const s = command.trim();
      if (!s) {
        return { kind: "empty" };
      }
      if (/[\r\n]/.test(s)) {
        throw new Error("\u5373\u6642\u30E2\u30FC\u30C9\u306B\u306F1\u884C\u305A\u3064\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      }
      let m;
      if (m = s.match(/^(\d+)\s*(.*)$/)) {
        const n = Number(m[1]);
        if (!Number.isSafeInteger(n)) {
          throw new Error("\u884C\u756A\u53F7\u304C\u5927\u304D\u3059\u304E\u307E\u3059");
        }
        const lines = new Map(this.lines());
        if (m[2]) {
          lines.set(n, m[2]);
        } else {
          lines.delete(n);
        }
        this.io.setSource(
          [...lines].sort((a, b) => a[0] - b[0]).map(([n2, text]) => n2 + " " + text).join("\n")
        );
        this.basic.resetVariables();
        return { kind: "edit", silent: true };
      }
      if (m = s.match(/^(SAVE|LOAD|MERGE)\s+"([^"]+)"(?:\s*,\s*([AR]))?$/i)) {
        const action = m[1].toUpperCase(), name = m[2], option = m[3]?.toUpperCase();
        if (option && !(action === "SAVE" && option === "A" || action === "LOAD" && option === "R")) {
          throw new Error("\u4FDD\u5B58\u30FB\u8AAD\u8FBC\u30AA\u30D7\u30B7\u30E7\u30F3\u304C\u4E0D\u6B63\u3067\u3059");
        }
        const programs = this.io.readPrograms ? this.io.readPrograms() : this.programs;
        if (action === "SAVE") {
          Object.defineProperty(programs, name, {
            value: this.io.getSource(),
            enumerable: true,
            writable: true,
            configurable: true
          });
          if (this.io.writePrograms) {
            this.io.writePrograms(programs);
          } else {
            this.programs = programs;
          }
          return { kind: "save" };
        }
        if (!Object.hasOwn(programs, name) || typeof programs[name] !== "string") {
          throw new Error("\u4FDD\u5B58\u3057\u305F\u30D7\u30ED\u30B0\u30E9\u30E0\u304C\u3042\u308A\u307E\u305B\u3093: " + name);
        }
        const imported = parseProgramLines(programs[name]);
        const lines = action === "MERGE" ? new Map(this.lines()) : /* @__PURE__ */ new Map();
        for (const [n, line] of imported) {
          lines.set(n, line);
        }
        this.io.setSource(
          [...lines].sort((a, b) => a[0] - b[0]).map(([n, line]) => n + " " + line).join("\n")
        );
        this.basic.resetVariables();
        if (option === "R") {
          return {
            kind: "run",
            ...await this.basic.run(this.io.getSource())
          };
        }
        return { kind: action === "LOAD" ? "load" : "merge" };
      }
      if (/^FILES$/i.test(s)) {
        const programs = this.io.readPrograms ? this.io.readPrograms() : this.programs;
        for (const name of Object.keys(programs).sort()) {
          this.io.print(name + "\n");
        }
        return { kind: "files" };
      }
      if (m = s.match(/^DELETE\s+(\d+)?\s*(-)?\s*(\d+)?$/i)) {
        if (!m[1] && !m[3]) {
          throw new Error("\u524A\u9664\u3059\u308B\u884C\u756A\u53F7\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
        const from = m[1] === void 0 ? 0 : Number(m[1]), to = m[2] ? m[3] === void 0 ? Infinity : Number(m[3]) : from;
        if (m[3] && !m[2] || from > to) {
          throw new Error("DELETE\u306E\u7BC4\u56F2\u304C\u4E0D\u6B63\u3067\u3059");
        }
        this.io.setSource(
          this.lines().filter(([n]) => n < from || n > to).map(([n, line]) => n + " " + line).join("\n")
        );
        this.basic.resetVariables();
        return { kind: "edit" };
      }
      if (m = s.match(/^RENUM(?:\s+(.*))?$/i)) {
        return this.renumber(m[1] || "");
      }
      if (m = s.match(/^RUN(?:\s+(\d+|\*[A-Z][A-Z0-9_]*))?$/i)) {
        return {
          kind: "run",
          ...await this.basic.run(
            this.io.getSource(),
            m[1] === void 0 ? void 0 : m[1]
          )
        };
      }
      if (/^NEW$/i.test(s)) {
        this.io.setSource("");
        this.basic.resetVariables();
        return { kind: "new" };
      }
      if (/^CLEAR$/i.test(s)) {
        this.basic.resetVariables();
        return { kind: "clear" };
      }
      if (m = s.match(/^LIST(?:\s+(\d+)?\s*(-)?\s*(\d+)?)?$/i)) {
        const from = m[1] === void 0 ? 0 : Number(m[1]);
        const to = m[2] ? m[3] === void 0 ? Infinity : Number(m[3]) : m[1] === void 0 ? Infinity : from;
        if (m[3] && !m[2] || from > to) {
          throw new Error("LIST\u306E\u7BC4\u56F2\u304C\u4E0D\u6B63\u3067\u3059");
        }
        for (const [n, text] of this.lines()) {
          if (n >= from && n <= to) {
            this.io.print(n + " " + text + "\n");
          }
        }
        return { kind: "list" };
      }
      return {
        kind: "direct",
        ...await this.basic.immediate(s, this.io.getSource())
      };
    }
  };

  // src/keyboard.ts
  var Keyboard = class {
    queue = [];
    held = /* @__PURE__ */ new Map();
    characters = /* @__PURE__ */ new Map();
    constructor() {
      this.clear();
    }
    normalize(key) {
      const k = key.toUpperCase();
      return {
        ARROWLEFT: "LEFT",
        ARROWRIGHT: "RIGHT",
        ARROWUP: "UP",
        ARROWDOWN: "DOWN",
        " ": "SPACE",
        RETURN: "ENTER"
      }[k] || k;
    }
    press(key, source = key, repeat = false) {
      if (this.held.has(source) && !repeat) {
        return;
      }
      this.held.set(source, this.normalize(key));
      const code = {
        LEFT: 29,
        RIGHT: 28,
        UP: 30,
        DOWN: 31,
        ENTER: 13,
        SPACE: 32,
        BACKSPACE: 8,
        DELETE: 127
      };
      const normalized = this.normalize(key);
      const value = code[normalized] !== void 0 ? String.fromCharCode(code[normalized]) : key.length === 1 ? key : "";
      if (value) {
        this.characters.set(source, value);
      }
      if (value) {
        if (this.queue.length === 64) {
          this.queue.shift();
        }
        this.queue.push(value);
      }
    }
    release(source) {
      this.held.delete(source);
      this.characters.delete(source);
    }
    read(continuous = false) {
      return this.queue.shift() ?? (continuous ? [...this.characters.values()].at(-1) ?? "" : "");
    }
    isDown(key) {
      return [...this.held.values()].includes(this.normalize(key));
    }
    clear() {
      this.queue = [];
      this.held = /* @__PURE__ */ new Map();
      this.characters = /* @__PURE__ */ new Map();
    }
  };

  // src/samples.ts
  var samples = {
    inkey: `10 CLS 3
20 PRINT "\u30AD\u30FC\u3092\u62BC\u3059\u3068\u6587\u5B57\u30B3\u30FC\u30C9\u3092\u8868\u793A\u3057\u307E\u3059\u3002Q\u3067\u7D42\u4E86"
30 K$=INKEY$
40 IF K$="" THEN 30
50 PRINT "KEY=[";K$;"] CODE=";ASC(K$)
60 IF K$="q" OR K$="Q" THEN END
70 GOTO 30
`,
    breakout: `10 REM \u30D6\u30ED\u30C3\u30AF\u5D29\u3057 / \u5DE6\u53F3\u30AD\u30FC\u30FBA D \u3067\u79FB\u52D5
20 REM INKEY$\u306F\u5165\u529B\u5F85\u3061\u306A\u3057 / KEYDOWN\u3068SLEEP\u306F\u30D6\u30E9\u30A6\u30B6\u62E1\u5F35
30 DIM B(23)
40 CLS 3
50 COLOR 6: LOCATE 27,8: PRINT "N88 BLOCK BREAKER"
60 COLOR 7: LOCATE 22,11: PRINT "\u5DE6\u53F3\u30AD\u30FC / A D \u3067\u30D1\u30C9\u30EB\u3092\u64CD\u4F5C"
70 LOCATE 22,13: PRINT "24\u500B\u306E\u30D6\u30ED\u30C3\u30AF\u3092\u3059\u3079\u3066\u58CA\u305D\u3046\uFF01"
80 LOCATE 22,16: PRINT "SPACE \u307E\u305F\u306F\u753B\u9762\u306E\u767A\u5C04\u30DC\u30BF\u30F3"
90 K$=INKEY$
100 IF K$=" " THEN GOTO 130
110 SLEEP 16
120 GOTO 90
130 SCORE=0: LIVES=3
140 FOR I=0 TO 23: B(I)=1: NEXT I
150 CLS 3
160 COLOR 5: LOCATE 2,0: PRINT "N88 BLOCK BREAKER"
170 GOSUB 1000
180 FOR I=0 TO 23
190 BX=24+(I MOD 8)*74: BY=64+INT(I/8)*28
200 LINE (BX,BY)-(BX+66,BY+18),INT(I/8)+2,BF
210 NEXT I
220 PX=270: X=320: Y=329: VX=3: VY=-5
230 LINE (PX,350)-(PX+100,359),4,BF
240 LINE (X-4,Y-4)-(X+4,Y+4),7,BF
250 COLOR 7: LOCATE 20,24: PRINT "SPACE: \u767A\u5C04   \u5DE6\u53F3 / A D: \u79FB\u52D5";
260 K$=INKEY$
270 IF K$=" " THEN GOTO 330
280 SLEEP 16
290 GOTO 260
330 LOCATE 20,24: PRINT SPACE$(55);
340 LINE (X-4,Y-4)-(X+4,Y+4),0,BF
350 LINE (PX,350)-(PX+100,359),0,BF
355 K$=INKEY$
360 IF KEYDOWN("LEFT") OR KEYDOWN("A") OR K$=CHR$(29) OR K$="a" OR K$="A" THEN PX=PX-9
370 IF KEYDOWN("RIGHT") OR KEYDOWN("D") OR K$=CHR$(28) OR K$="d" OR K$="D" THEN PX=PX+9
380 IF PX<8 THEN PX=8
390 IF PX>532 THEN PX=532
400 X=X+VX: Y=Y+VY
410 IF X<12 THEN X=12: VX=ABS(VX)
420 IF X>628 THEN X=628: VX=-ABS(VX)
430 IF Y<40 THEN Y=40: VY=ABS(VY)
440 IF VY>0 AND Y>=344 AND Y<=354 AND X>=PX-4 AND X<=PX+104 THEN VY=-ABS(VY): VX=(X-PX-50)/12: Y=344
450 HIT=-1
460 FOR I=0 TO 23
470 BX=24+(I MOD 8)*74: BY=64+INT(I/8)*28
480 IF B(I)=1 AND HIT=-1 AND X>=BX-4 AND X<=BX+70 AND Y>=BY-4 AND Y<=BY+22 THEN HIT=I
490 NEXT I
500 IF HIT=-1 THEN GOTO 570
510 B(HIT)=0: SCORE=SCORE+10: VY=-VY
520 BX=24+(HIT MOD 8)*74: BY=64+INT(HIT/8)*28
530 LINE (BX,BY)-(BX+66,BY+18),0,BF
540 GOSUB 1000
550 IF SCORE=240 THEN GOTO 800
570 LINE (PX,350)-(PX+100,359),4,BF
580 LINE (X-4,Y-4)-(X+4,Y+4),7,BF
590 IF Y>388 THEN GOTO 650
600 SLEEP 16
610 GOTO 340
650 LIVES=LIVES-1: GOSUB 1000
660 LINE (X-4,Y-4)-(X+4,Y+4),0,BF
670 LINE (PX,350)-(PX+100,359),0,BF
680 IF LIVES=0 THEN GOTO 850
690 GOTO 220
800 COLOR 6: LOCATE 28,12: PRINT "CLEAR! \u304A\u3081\u3067\u3068\u3046\uFF01"
810 GOTO 870
850 COLOR 2: LOCATE 31,12: PRINT "GAME OVER"
870 COLOR 7: LOCATE 24,15: PRINT "SCORE: ";SCORE
880 LOCATE 22,18: PRINT "SPACE / \u767A\u5C04\u30DC\u30BF\u30F3\u3067\u3082\u3046\u4E00\u5EA6"
890 K$=INKEY$
900 SLEEP 16
910 K$=INKEY$
920 IF K$=" " THEN GOTO 130
930 GOTO 900
1000 COLOR 7: LOCATE 40,0: PRINT "SCORE ";SCORE;"    LIVES ";LIVES;"   ";
1010 RETURN`,
    hello: `10 REM \u306F\u3058\u3081\u3066\u306E\u65E5\u672C\u8A9EBASIC
20 CLS 3
30 COLOR 7
40 PRINT "\u3053\u3093\u306B\u3061\u306F\u3001N88-BASIC\uFF01"
50 PRINT ""
60 COLOR 4
70 PRINT "\u30D6\u30E9\u30A6\u30B6\u304B\u3089\u3001\u3082\u306E\u3065\u304F\u308A\u3092\u306F\u3058\u3081\u3088\u3046\u3002"
80 PRINT ""
90 FOR I = 1 TO 5
100 COLOR I
110 PRINT "  HELLO, BASIC!  "; I
120 NEXT I
130 COLOR 7
140 PRINT ""
150 PRINT "Ready."
160 END`,
    graphic: `10 REM \u8679\u8272\u306E\u30B0\u30E9\u30D5\u30A3\u30C3\u30AF\u30B9
20 CLS 3
30 FOR R = 180 TO 10 STEP -10
40 C = INT(R / 10) MOD 7 + 1
50 CIRCLE (320,200),R,C
60 NEXT R
70 FOR X = 0 TO 640 STEP 32
80 LINE (320,200)-(X,399),4
90 NEXT X
100 COLOR 7
110 LOCATE 2,1
120 PRINT "N88 GRAPHICS / \u8272\u3068\u7DDA\u3067\u3042\u305D\u307C\u3046"
130 END`,
    guess: `10 CLS 3
20 COLOR 6
30 PRINT "\u6570\u3042\u3066\u30B2\u30FC\u30E0 / 1\u304B\u3089100"
40 N = INT(RND(1) * 100) + 1
50 T = 0
60 INPUT "\u3044\u304F\u3064\u3067\u3057\u3087\u3046\uFF1F"; A
70 T = T + 1
80 IF A < N THEN PRINT "\u3082\u3063\u3068\u5927\u304D\u3044\u3067\u3059\u3002": GOTO 60
90 IF A > N THEN PRINT "\u3082\u3063\u3068\u5C0F\u3055\u3044\u3067\u3059\u3002": GOTO 60
100 COLOR 4
110 PRINT "\u6B63\u89E3\uFF01 "; T; "\u56DE\u3067\u5F53\u305F\u308A\u307E\u3057\u305F\u3002"
120 END`,
    table: `10 CLS 3
20 COLOR 6
30 PRINT "\u4E5D\u4E5D\u306E\u8868"
40 PRINT ""
50 FOR I = 1 TO 9
60 COLOR I MOD 7 + 1
70 FOR J = 1 TO 9
80 A$ = "   " + STR$(I * J)
90 PRINT RIGHT$(A$,4);
100 NEXT J
110 PRINT ""
120 NEXT I
130 END`
  };

  // src/app.ts
  function $(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing screen element: ${id}`);
    }
    return element;
  }
  var keyboard = new Keyboard();
  var speedOptions = [0, 0.25, 0.5, 1, 2, 4];
  var executionSpeed = 1;
  try {
    const savedSpeed = localStorage.getItem("n88-speed");
    if (savedSpeed !== null && speedOptions.includes(Number(savedSpeed))) {
      executionSpeed = Number(savedSpeed);
    }
  } catch {
  }
  $("executionSpeed").value = String(executionSpeed);
  $("executionSpeed").addEventListener("change", () => {
    const value = Number($("executionSpeed").value);
    if (!speedOptions.includes(value)) {
      return;
    }
    executionSpeed = value;
    try {
      localStorage.setItem("n88-speed", String(value));
    } catch {
    }
  });
  var colors = [
    "#000000",
    "#668eff",
    "#ed6b76",
    "#d18ef0",
    "#78dca3",
    "#70d7e3",
    "#f2d980",
    "#ffffff"
  ];
  var g = $("graphics").getContext("2d");
  var t = $("textScreen").getContext("2d");
  var x = 0;
  var y = 0;
  var color = 7;
  var running = false;
  var pending = null;
  var screenRows = Array.from({ length: 25 }, () => Array(80).fill(" "));
  function clear(mode = 3) {
    if (mode & 2) {
      g.clearRect(0, 0, 640, 400);
    }
    if (mode & 1) {
      screenRows = Array.from({ length: 25 }, () => Array(80).fill(" "));
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
      screenRows.push(Array(80).fill(" "));
    }
  }
  function print(str) {
    const output = $("accessibleOutput");
    output.textContent = (output.textContent + str).slice(-12e3);
    t.font = "14px monospace";
    t.textBaseline = "top";
    for (const c of str) {
      if (c === "\n") {
        newline();
        continue;
      }
      const width = c.codePointAt(0) > 255 ? 2 : 1;
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
  function positionScreenInput() {
    const screen = $("gameScreen");
    const scale = screen.clientWidth / 640;
    const left = Math.min(x, 79) * 8;
    for (const id of ["immediateForm", "inputForm"]) {
      const form = $(id);
      form.style.left = left / 640 * 100 + "%";
      form.style.top = y / 25 * 100 + "%";
      form.style.width = (640 - left) / 640 * 100 + "%";
      form.style.height = 16 * scale + "px";
    }
    screen.style.setProperty("--terminal-font", 14 * scale + "px");
    screen.style.setProperty("--terminal-line", 16 * scale + "px");
    if (typeof CustomEvent !== "undefined") {
      document.dispatchEvent(new CustomEvent("terminal-layout"));
    }
  }
  var { selectedColor, point, paint } = createGraphics(g, colors, () => color);
  var audioContext;
  function beep() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) {
      throw new Error("\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u3067\u306F\u97F3\u3092\u518D\u751F\u3067\u304D\u307E\u305B\u3093");
    }
    audioContext ??= new Audio();
    audioContext.resume().catch(reportAsyncError);
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
  }
  var basic = new Basic({
    speed: () => executionSpeed,
    print,
    clear,
    point,
    paint,
    beep,
    play: (notes, signal) => {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) {
        throw new Error("\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u3067\u306F\u97F3\u3092\u518D\u751F\u3067\u304D\u307E\u305B\u3093");
      }
      audioContext ??= new Audio();
      return playMusic(audioContext, notes, signal);
    },
    cursor: () => ({ x, y }),
    inkey: () => keyboard.read(true),
    keydown: (key) => keyboard.isDown(key),
    color: (c) => {
      color = (Math.trunc(c) % 8 + 8) % 8;
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
          Math.abs(d - b) + 1
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
        throw new Error("\u534A\u5F84\u306F0\u4EE5\u4E0A\u306B\u3057\u3066\u304F\u3060\u3055\u3044");
      }
      g.strokeStyle = selectedColor(c);
      g.beginPath();
      g.arc(a, b, r, 0, Math.PI * 2);
      g.stroke();
    },
    input: (prompt) => new Promise((resolve) => {
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
    }
  });
  function update() {
    const n = $("source").value.split("\n").length;
    $("lineCount").textContent = n + " LINES";
    $("gutter").textContent = Array.from(
      { length: n },
      (_, i) => String(i + 1)
    ).join("\n");
    try {
      localStorage.setItem("n88-source", $("source").value);
    } catch {
    }
  }
  $("source").addEventListener("input", update);
  $("source").addEventListener("scroll", () => {
    $("gutter").scrollTop = $("source").scrollTop;
  });
  var session = new Session(basic, {
    getSource: () => $("source").value,
    readPrograms: () => readPrograms(localStorage),
    writePrograms: (programs) => writePrograms(localStorage, programs),
    setSource: (value) => {
      $("source").value = value;
      update();
    },
    print
  });
  function setBusy(busy) {
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
      "screenLoad"
    ]) {
      $(id).disabled = busy;
    }
    $("stop").disabled = !busy;
    $("screenStop").disabled = !busy;
    $("immediateForm").hidden = busy;
    positionScreenInput();
  }
  async function execute(work, { freshScreen = false, direct = false } = {}) {
    if (running) {
      return;
    }
    setBusy(true);
    $("gameScreen").focus({ preventScroll: true });
    $("status").textContent = "RUNNING";
    $("message").className = "";
    $("message").textContent = direct ? "\u5373\u6642\u30B3\u30DE\u30F3\u30C9\u3092\u5B9F\u884C\u3057\u3066\u3044\u307E\u3059\u2026" : "\u30D7\u30ED\u30B0\u30E9\u30E0\u3092\u5B9F\u884C\u3057\u3066\u3044\u307E\u3059\u2026";
    if (freshScreen) {
      color = 7;
      clear();
    }
    let preserveNextRow = false;
    try {
      const result = await work();
      preserveNextRow = !!("silent" in result && result.silent);
      $("message").textContent = result.stopped ? "\u5B9F\u884C\u3092\u505C\u6B62\u3057\u307E\u3057\u305F\u3002" : direct ? "Ok \u2014 \u6B21\u306E\u547D\u4EE4\u3092\u5165\u529B\u3067\u304D\u307E\u3059\u3002" : "\u5B9F\u884C\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002";
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
  function paintScreenRow(value) {
    t.clearRect(0, y * 16, 640, 16);
    screenRows[y] = Array(80).fill(" ");
    t.font = "14px monospace";
    t.textBaseline = "top";
    t.fillStyle = colors[7];
    let col = 0;
    for (const c of value) {
      const width = c.codePointAt(0) > 255 ? 2 : 1;
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
  function moveScreenRow(direction) {
    if (running) {
      return;
    }
    const input = $("command"), next = Math.max(0, Math.min(24, y + direction));
    if (next === y) {
      return;
    }
    const column = Array.from(
      input.value.slice(0, input.selectionStart ?? 0)
    ).reduce((n, c) => n + (c.codePointAt(0) > 255 ? 2 : 1), 0);
    paintScreenRow(input.value);
    y = next;
    x = 0;
    loadScreenRow(column);
  }
  function loadScreenRow(column = 0) {
    const input = $("command");
    let value = screenRows[y].join("").trimEnd(), col = 0, index = 0;
    while (index < value.length && col < column) {
      const c = String.fromCodePoint(value.codePointAt(index));
      col += c.codePointAt(0) > 255 ? 2 : 1;
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
  var commandHistory = [];
  var historyIndex = 0;
  var historyDraft = "";
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
          historyIndex + (e.key === "ArrowUp" ? -1 : 1)
        )
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
  function loadSample(name) {
    if (running) {
      return false;
    }
    if ($("source").value !== samples[name] && !confirm(
      "\u73FE\u5728\u306E\u30D7\u30ED\u30B0\u30E9\u30E0\u3092\u30B5\u30F3\u30D7\u30EB\u306B\u7F6E\u304D\u63DB\u3048\u307E\u3059\u304B\uFF1F \u5927\u5207\u306A\u30B3\u30FC\u30C9\u306F\u5148\u306B\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
    )) {
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
    const a = document.createElement("a"), url = URL.createObjectURL(
      new Blob([$("source").value], { type: "text/plain;charset=utf-8" })
    );
    a.href = url;
    a.download = "program.bas";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  };
  $("import").onclick = () => $("file").click();
  $("file").onchange = async () => {
    const file = $("file").files?.[0];
    if (!file) {
      return;
    }
    if (file.size > 1e6) {
      alert("1MB\u4EE5\u4E0B\u306E\u30D5\u30A1\u30A4\u30EB\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    const value = await file.text();
    if (confirm("\u73FE\u5728\u306E\u30D7\u30ED\u30B0\u30E9\u30E0\u3092\u8AAD\u307F\u8FBC\u3093\u3060\u30D5\u30A1\u30A4\u30EB\u306B\u7F6E\u304D\u63DB\u3048\u307E\u3059\u304B\uFF1F")) {
      $("source").value = value;
      update();
    }
    $("file").value = "";
  };
  var gameScreen = $("gameScreen");
  new ResizeObserver(positionScreenInput).observe(gameScreen);
  gameScreen.addEventListener("click", (e) => {
    if (e.target.closest("input,button")) {
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
    return document.activeElement === gameScreen || $("gameControls").contains(document.activeElement);
  }
  document.addEventListener("keydown", (e) => {
    if (!running || pending || !gameFocused() || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }
    if (["Escape", "Tab"].includes(e.key)) {
      return;
    }
    if (e.key.length === 1 || [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Enter",
      "Backspace",
      "Delete"
    ].includes(e.key)) {
      e.preventDefault();
      keyboard.press(e.key, "keyboard:" + e.code, e.repeat);
    }
  });
  document.addEventListener(
    "keyup",
    (e) => keyboard.release("keyboard:" + e.code)
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
  for (const button of document.querySelectorAll(
    "[data-game-key]"
  )) {
    button.addEventListener("pointerdown", (e) => {
      if (!running || pending) {
        return;
      }
      e.preventDefault();
      gameScreen.focus({ preventScroll: true });
      button.setPointerCapture(e.pointerId);
      keyboard.press(button.dataset.gameKey, "pointer:" + e.pointerId);
      button.classList.add("pressed");
    });
    const release = (e) => {
      keyboard.release("pointer:" + e.pointerId);
      button.classList.remove("pressed");
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("click", (e) => {
      if (e.detail === 0 && running && !pending) {
        keyboard.press(button.dataset.gameKey, "accessible");
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
    const input = $("command"), draft = input.value;
    input.value = "";
    input.setSelectionRange(0, 0);
    historyIndex = commandHistory.length;
    historyDraft = "";
    x = 0;
    paintScreenRow("");
    print(draft + "\n");
    $("status").textContent = "READY";
    $("message").className = "";
    $("message").textContent = "\u5165\u529B\u3092\u53D6\u308A\u6D88\u3057\u307E\u3057\u305F\u3002";
    input.focus({ preventScroll: true });
  }
  function terminalHasSelection() {
    const input = document.activeElement;
    return (input === $("command") || input === $("inputValue")) && input.selectionStart !== input.selectionEnd;
  }
  document.addEventListener(
    "keydown",
    (e) => {
      const inTerminal = gameScreen.contains(document.activeElement);
      const copyKey = e.metaKey && inTerminal && (running || !terminalHasSelection());
      if ((running || inTerminal) && !e.altKey && (e.ctrlKey || copyKey) && (e.key.toLowerCase() === "c" || e.code === "KeyC")) {
        e.preventDefault();
        e.stopPropagation();
        interruptTerminal();
      }
    },
    true
  );
  document.addEventListener("copy", (e) => {
    if (gameScreen.contains(document.activeElement) && (running || !terminalHasSelection())) {
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
  var saved;
  try {
    saved = localStorage.getItem("n88-source");
  } catch {
  }
  $("source").value = saved ?? samples.hello;
  var matchingSample = Object.keys(samples).find(
    (name) => samples[name] === $("source").value
  );
  if (matchingSample) {
    $("sample").value = matchingSample;
  }
  update();
  clear();
  print(
    "AI N-88 BASIC(86) version 3.0\nCopyright (C) 2026 by TY\n67108864 Bytes free\nOk\n"
  );
  function setExpanded(expanded) {
    document.body.classList.toggle("terminal-expanded", expanded);
    $("toggleScreen").textContent = expanded ? "\u30B3\u30FC\u30C9\u30FB\u4FDD\u5B58" : "BASIC\u753B\u9762\u3078";
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
  $("toggleScreen").onclick = () => setExpanded(!document.body.classList.contains("terminal-expanded"));
  $("screenStop").onclick = () => basic.stop();
  setExpanded(
    typeof location === "undefined" || new URLSearchParams(location.search).get("editor") !== "1"
  );
  function reportAsyncError(error) {
    $("message").textContent = error instanceof Error ? error.message : String(error);
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
    importFile: () => $("file").click()
  });
})();
//# sourceMappingURL=app.js.map
