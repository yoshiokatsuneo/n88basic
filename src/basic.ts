import { parseMusic } from "./music.js";
import { BasicError } from "./errors.js";
import { argumentsOf, keywordAt, splitOutside } from "./syntax.js";
import { evaluateExpression } from "./expression.js";
export { BasicError } from "./errors.js";
import type { BasicIO, BasicValue, RunResult } from "./types.js";
export class Basic {
  stopped = false;
  executing = false;
  vars: Partial<Record<string, BasicValue>> = {};
  arrays: Partial<Record<string, number[]>> = {};
  seed = 1;
  lastRandom = 0;
  base = 0;
  types: Partial<Record<string, string>> = {};
  functions: Partial<Record<string, { params: string[]; body: string }>> = {};
  fnDepth = 0;
  code: { number: number | null; text: string }[] = [];
  labels: Partial<Record<string, number>> = {};
  labelLines: Partial<Record<string, number>> = {};
  data: BasicValue[] = [];
  dataLines: { number: number; index: number }[] = [];
  dataPos = 0;
  pc = 0;
  programError: unknown = null;
  stack: number[] = [];
  loops: { name: string; end: number; step: number; pc: number }[] = [];
  whiles: number[] = [];
  paceDebt = 0;
  paceTime: number | undefined;
  cancelSleep: (() => void) | null = null;

  constructor(public readonly io: BasicIO = {}) {}
  private musicAbort: AbortController | null = null;
  stop() {
    this.stopped = true;
    this.musicAbort?.abort();
    this.cancelSleep?.();
    if (this.io.cancelInput) {
      this.io.cancelInput();
    }
  }
  typeOf(name: string) {
    return /[$%!#]$/.test(name) ? name.slice(-1) : this.types[name[0]] || "!";
  }
  get(name: string): BasicValue {
    name = name.toUpperCase();
    return this.vars[name] ?? (this.typeOf(name) === "$" ? "" : 0);
  }
  numberExpression(source: string): number {
    const value = this.expression(source);
    if (typeof value !== "number") {
      throw new BasicError("数値が必要です");
    }
    return value;
  }
  expression(source: string): BasicValue {
    return evaluateExpression(source, this);
  }
  call(functionName: string, args: BasicValue[]): BasicValue {
    const extra = this.extraFunction(functionName, args);
    if (extra.handled) {
      return extra.value;
    }
    if (functionName === "KEYDOWN") {
      if (args.length !== 1 || typeof args[0] !== "string") {
        throw new BasicError("KEYDOWNにはキー名を指定してください");
      }
      return this.io.keydown?.(args[0]) ? -1 : 0;
    }
    const funcs: Record<string, (...args: BasicValue[]) => BasicValue> = {
      ABS: (x) => Math.abs(Number(x)),
      INT: (x) => Math.floor(Number(x)),
      FIX: (x) => Math.trunc(Number(x)),
      SQR: (x) => Math.sqrt(Number(x)),
      SIN: (x) => Math.sin(Number(x)),
      COS: (x) => Math.cos(Number(x)),
      TAN: (x) => Math.tan(Number(x)),
      ATN: (x) => Math.atan(Number(x)),
      LOG: (x) => Math.log(Number(x)),
      EXP: (x) => Math.exp(Number(x)),
      SGN: (x) => Math.sign(Number(x)),
      RND: (n) => this.random(n === undefined ? 1 : Number(n)),
      LEN: (s) => String(s).length,
      VAL: (s) => parseFloat(String(s)) || 0,
      STR$: (x) => String(x),
      CHR$: (x) => String.fromCharCode(Number(x)),
      ASC: (s) => String(s).charCodeAt(0),
      LEFT$: (s, n) => String(s).slice(0, Number(n)),
      RIGHT$: (s, n) => (n === 0 ? "" : String(s).slice(-Number(n))),
      MID$: (s, n, l) =>
        String(s).slice(
          Number(n) - 1,
          l === undefined ? undefined : Number(n) - 1 + Number(l),
        ),
      SPACE$: (n) => " ".repeat(Math.max(0, Math.min(1000, Number(n)))),
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
      this.seed = (Math.abs(Math.trunc(n)) * 2654435761) >>> 0;
    }
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return (this.lastRandom = this.seed / 4294967296);
  }
  extraFunction(
    functionName: string,
    args: BasicValue[],
  ): { handled: false } | { handled: true; value: BasicValue } {
    const count = (min: number, max = min) => {
      if (args.length < min || args.length > max) {
        throw new BasicError(functionName + "の引数の数が不正です");
      }
    };
    const integer = (v: BasicValue, min: number, max: number) => {
      if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
        throw new BasicError(functionName + "の引数が範囲外です");
      }
      return Math.trunc(v);
    };
    let value: BasicValue;
    switch (functionName) {
      case "INSTR": {
        count(2, 3);
        const start = args.length === 3 ? integer(args[0], 1, 65535) : 1;
        const str = String(args[args.length - 2]),
          search = String(args.at(-1));
        value = start > str.length ? 0 : str.indexOf(search, start - 1) + 1;
        break;
      }
      case "STRING$":
        count(2);
        value = (
          typeof args[1] === "number"
            ? String.fromCharCode(integer(args[1], 0, 65535))
            : String(args[1]).slice(0, 1)
        ).repeat(integer(args[0], 0, 65535));
        break;
      case "HEX$":
      case "OCT$":
        count(1);
        value = (integer(args[0], -32768, 65535) & 65535)
          .toString(functionName === "HEX$" ? 16 : 8)
          .toUpperCase();
        break;
      case "CINT":
        count(1);
        value = Math.round(Number(args[0]));
        if (value < -32768 || value > 32767 || !Number.isFinite(value)) {
          throw new BasicError("整数の範囲外です");
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
          throw new BasicError("POINTを使えない環境です");
        }
        value = this.io.point(Number(args[0]), Number(args[1]));
        break;
      case "SPC":
        count(1);
        value = " ".repeat(integer(args[0], 0, 1000));
        break;
      case "TAB": {
        count(1);
        const column = integer(args[0], 0, 79),
          current = this.io.cursor?.().x ?? 0;
        value =
          (column < current ? "\n" : "") +
          " ".repeat(column < current ? column : column - current);
        break;
      }
      default: {
        if (!functionName.startsWith("FN")) {
          return { handled: false };
        }
        const fn = this.functions[functionName];
        if (!fn) {
          throw new BasicError("関数が定義されていません: " + functionName);
        }
        count(fn.params.length);
        if (this.fnDepth >= 64) {
          throw new BasicError("関数の呼び出しが深すぎます");
        }
        const previous = fn.params.map((p) => ({
          parameterName: p,
          exists: Object.hasOwn(this.vars, p),
          value: this.vars[p],
        }));
        this.fnDepth++;
        try {
          fn.params.forEach((p, i) => this.assign(p, args[i]));
          value = this.expression(fn.body);
        } finally {
          for (const p of previous) {
            if (p.exists && p.value !== undefined) {
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
  extraStatement(statementSource: string): boolean | Promise<boolean> {
    let match;
    if (
      (match = statementSource.match(
        /^ON\s+(.+?)\s+GO(SUB|TO)\s+((?:\d+|\*[A-Z][A-Z0-9_]*)(?:\s*,\s*(?:\d+|\*[A-Z][A-Z0-9_]*))*)$/i,
      ))
    ) {
      const n = Math.trunc(this.numberExpression(match[1])),
        targets = match[3].split(",").map((v) => v.trim());
      if (n < 0 || n > 255) {
        throw new BasicError("ONの選択番号は0〜255です");
      }
      if (targets.some((v) => !/^(?:\d+|\*[A-Z][A-Z0-9_]*)$/i.test(v))) {
        throw new BasicError("行番号の一覧が不正です");
      }
      if (n > 0 && n <= targets.length) {
        if (match[2].toUpperCase() === "SUB") {
          this.stack.push(this.pc);
        }
        this.jump(targets[n - 1]);
      }
      return true;
    }
    if ((match = statementSource.match(/^WHILE\s+(.+)$/i))) {
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
          throw new BasicError("WENDがありません");
        }
        if (this.whiles.at(-1) === start) {
          this.whiles.pop();
        }
      }
      return true;
    }
    if (/^WEND$/i.test(statementSource)) {
      if (!this.whiles.length) {
        throw new BasicError("WHILEのないWENDです");
      }
      this.pc = this.whiles.at(-1)!;
      return true;
    }
    if (
      (match = statementSource.match(
        /^DEF\s+(FN[A-Z][A-Z0-9]*[$%!#]?)\s*\(([^)]*)\)\s*=\s*(.+)$/i,
      ))
    ) {
      const params = match[2].trim()
        ? match[2].split(",").map((v) => v.trim().toUpperCase())
        : [];
      if (
        params.some((p) => !/^([A-Z][A-Z0-9]*[$%!#]?)$/.test(p)) ||
        new Set(params).size !== params.length
      ) {
        throw new BasicError("DEF FNの引数が不正です");
      }
      this.functions[match[1].toUpperCase()] = { params, body: match[3] };
      return true;
    }
    if ((match = statementSource.match(/^DEF(INT|SNG|DBL|STR)\s+(.+)$/i))) {
      const type = (
        { INT: "%", SNG: "!", DBL: "#", STR: "$" } as Record<string, string>
      )[match[1].toUpperCase()];
      for (const part of match[2].toUpperCase().split(",")) {
        const range = part.trim().match(/^([A-Z])(?:-([A-Z]))?$/);
        if (!range) {
          throw new BasicError("型宣言の範囲が不正です");
        }
        const end = (range[2] || range[1]).charCodeAt(0);
        if (end < range[1].charCodeAt(0)) {
          throw new BasicError("型宣言の範囲が不正です");
        }
        for (let c = range[1].charCodeAt(0); c <= end; c++) {
          this.types[String.fromCharCode(c)] = type;
        }
      }
      return true;
    }
    if ((match = statementSource.match(/^OPTION\s+BASE\s+([01])$/i))) {
      if (Object.keys(this.arrays).length) {
        throw new BasicError("OPTION BASEはDIMより前に指定してください");
      }
      this.base = Number(match[1]);
      return true;
    }
    if ((match = statementSource.match(/^ERASE\s+(.+)$/i))) {
      for (const raw of match[1].split(",")) {
        const name = raw.trim().toUpperCase();
        if (!this.arrays[name]) {
          throw new BasicError("配列がありません: " + name);
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
    if ((match = statementSource.match(/^SWAP\s+(.+)$/i))) {
      const targets = argumentsOf(match[1]);
      if (targets.length !== 2) {
        throw new BasicError("SWAPには変数を2つ指定してください");
      }
      if (
        targets.some(
          (v) => !/^\s*[A-Z][A-Z0-9]*[$%!#]?(?:\(.*\))?\s*$/i.test(v),
        )
      ) {
        throw new BasicError("SWAPには変数を指定してください");
      }
      const values = targets.map((v) => this.expression(v));
      if (typeof values[0] !== typeof values[1]) {
        throw new BasicError("SWAPの型が一致しません");
      }
      this.assign(targets[0], values[1]);
      this.assign(targets[1], values[0]);
      return true;
    }
    if ((match = statementSource.match(/^MID\$\s*\((.*)\)\s*=\s*(.+)$/i))) {
      const args = argumentsOf(match[1]);
      if (args.length < 2 || args.length > 3) {
        throw new BasicError("MID$代入の書式が不正です");
      }
      const original = this.expression(args[0]),
        replacement = this.expression(match[2]);
      const start = Math.trunc(this.numberExpression(args[1])) - 1,
        length =
          args[2] === undefined
            ? String(replacement).length
            : Math.trunc(this.numberExpression(args[2]));
      if (
        typeof original !== "string" ||
        typeof replacement !== "string" ||
        start < 0 ||
        length < 0
      ) {
        throw new BasicError("MID$代入の引数が不正です");
      }
      const used = Math.min(
        length,
        replacement.length,
        Math.max(0, original.length - start),
      );
      this.assign(
        args[0],
        original.slice(0, start) +
          replacement.slice(0, used) +
          original.slice(start + used),
      );
      return true;
    }
    if (
      (match = statementSource.match(
        /^LINE\s+INPUT\s+(?:"([^"]*)"\s*;\s*)?(.+)$/i,
      ))
    ) {
      return (async () => {
        const value = await this.io.input?.(match[1] || "? ");
        if (!this.stopped) {
          this.assign(match[2], value ?? "");
        }
        return true;
      })();
    }
    if ((match = statementSource.match(/^RANDOMIZE(?:\s+(.+))?$/i))) {
      this.seed =
        (match[1]
          ? Math.trunc(this.numberExpression(match[1]))
          : Date.now()) >>> 0;
      return true;
    }
    if (/^CLEAR$/i.test(statementSource)) {
      this.resetVariables();
      return true;
    }
    if ((match = statementSource.match(/^PLAY\s+(.+)$/i))) {
      const args = argumentsOf(match[1]);
      if (args.length !== 1) {
        throw new BasicError("PLAYは単音の文字列1つに対応しています");
      }
      const score = this.expression(args[0]);
      if (typeof score !== "string") {
        throw new BasicError("PLAYには文字列を指定してください");
      }
      const notes = parseMusic(score);
      if (!this.io.play) {
        throw new BasicError("PLAYを使えない環境です");
      }
      const controller = new AbortController();
      this.musicAbort = controller;
      return this.io
        .play(notes, controller.signal)
        .then(() => true)
        .finally(() => {
          if (this.musicAbort === controller) {
            this.musicAbort = null;
          }
        });
    }
    if (/^BEEP$/i.test(statementSource)) {
      if (!this.io.beep) {
        throw new BasicError("BEEPを使えない環境です");
      }
      this.io.beep();
      return true;
    }
    if (
      (match = statementSource.match(/^PRESET\s*\((.*)\)(?:\s*,\s*(.+))?$/i))
    ) {
      const a = argumentsOf(match[1]).map((v) => this.expression(v));
      if (a.length !== 2) {
        throw new BasicError("座標を2つ指定してください");
      }
      this.io.pset?.(
        Number(a[0]),
        Number(a[1]),
        match[2] ? this.numberExpression(match[2]) : 0,
      );
      return true;
    }
    if ((match = statementSource.match(/^PAINT\s*\(([^)]*)\)\s*,\s*(.+)$/i))) {
      const xy = argumentsOf(match[1]).map((v) => this.expression(v)),
        a = argumentsOf(match[2]).map((v) => this.expression(v));
      if (xy.length !== 2 || a.length < 1 || a.length > 2) {
        throw new BasicError("PAINTの書式が不正です");
      }
      if (!this.io.paint) {
        throw new BasicError("PAINTを使えない環境です");
      }
      this.io.paint(
        Number(xy[0]),
        Number(xy[1]),
        Number(a[0]),
        Number(a[1] ?? a[0]),
      );
      return true;
    }
    if ((match = statementSource.match(/^NEXT\s+(.+,.+)$/i))) {
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
    if ((match = statementSource.match(/^PRINT\s+USING\s+(.+)$/i))) {
      const parts = splitOutside(match[1], ";");
      if (parts.length < 3) {
        throw new BasicError("PRINT USINGには書式と値を指定してください");
      }
      const format = this.expression(parts[0]);
      if (typeof format !== "string") {
        throw new BasicError("書式は文字列で指定してください");
      }
      const values = splitOutside(parts.slice(2).join(""), ";,")
        .filter((_, i) => i % 2 === 0)
        .filter((v) => v.trim())
        .map((v) => this.expression(v));
      const fields = [
        ...format.matchAll(/!|&|\\ *\\|[+]?#+(?:,#+)*(?:\.#+)?[+-]?/g),
      ];
      if (!fields.length || !values.length) {
        throw new BasicError("PRINT USINGの書式または値がありません");
      }
      let index = 0;
      while (index < values.length) {
        let at = 0,
          out = "";
        for (const f of fields) {
          out += format.slice(at, f.index);
          if (index >= values.length) {
            at = f.index;
            break;
          }
          const v = values[index++],
            field = f[0];
          if (field === "!" || field === "&" || field.startsWith("\\")) {
            if (typeof v !== "string") {
              throw new BasicError("文字列が必要です");
            }
            const length =
              field === "!" ? 1 : field === "&" ? v.length : field.length;
            out += v.slice(0, length).padEnd(length, " ");
          } else {
            if (typeof v !== "number") {
              throw new BasicError("数値が必要です");
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
            out +=
              text.length > field.length
                ? "%" + text
                : text.padStart(field.length, " ");
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
  arrayKey(name: string, indices: BasicValue[]) {
    const dims = this.arrays[name];
    if (!dims) {
      throw new BasicError("配列が定義されていません: " + name);
    }
    if (
      indices.length !== dims.length ||
      indices.some(
        (n, i) =>
          !Number.isInteger(n) ||
          typeof n !== "number" ||
          n < this.base ||
          n > dims[i],
      )
    ) {
      throw new BasicError("配列の添字が範囲外です");
    }
    return name + "(" + indices.join(",") + ")";
  }
  arrayValue(name: string, a: BasicValue[]): BasicValue {
    return (
      this.vars[this.arrayKey(name, a)] ?? (this.typeOf(name) === "$" ? "" : 0)
    );
  }
  assign(target: string, value: BasicValue) {
    const m = target
      .trim()
      .toUpperCase()
      .match(/^([A-Z_][A-Z_0-9]*[$%!#]?)(?:\((.*)\))?$/);
    if (!m) {
      throw new BasicError("変数名が不正です: " + target);
    }
    let name = m[1];
    if (m[2] !== undefined) {
      name = this.arrayKey(
        name,
        splitOutside(m[2], ",")
          .filter((_, i) => i % 2 === 0)
          .map((s) => this.expression(s)),
      );
    }
    if (this.typeOf(m[1]) === "$") {
      if (typeof value !== "string") {
        throw new BasicError("文字列が必要です");
      }
    } else {
      if (typeof value !== "number") {
        throw new BasicError("数値が必要です");
      }
      if (this.typeOf(m[1]) === "%") {
        value = Math.round(value);
      }
    }
    this.vars[name] = value;
  }
  compile(source: string) {
    const lines = [],
      seen = new Set();
    for (const raw of source.split(/\r?\n/)) {
      if (!raw.trim()) {
        continue;
      }
      const m = raw.match(/^\s*(\d+)\s*(.*)$/);
      if (!m) {
        throw new BasicError("各行の先頭に行番号を付けてください");
      }
      const number = Number(m[1]);
      if (seen.has(number)) {
        throw new BasicError("行番号が重複しています: " + number);
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
            throw new BasicError("ラベルが重複しています: " + key);
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
            ",",
          ).filter((_, i) => i % 2 === 0)) {
            const v = value.trim();
            this.data.push(
              /^".*"$/.test(v)
                ? v.slice(1, -1)
                : v !== "" && Number.isFinite(Number(v))
                  ? Number(v)
                  : v,
            );
          }
        }
      }
    }
  }
  jump(n: number | string) {
    if (this.programError) {
      throw this.programError;
    }
    const key = String(n).trim().toUpperCase(),
      dest = this.labels[key.startsWith("*") ? key : Number(key)];
    if (dest === undefined) {
      throw new BasicError(
        (key.startsWith("*")
          ? "ラベルがありません: "
          : "行番号がありません: ") + n,
      );
    }
    this.pc = dest;
  }
  sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
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
  async run(source: string, start?: number | string): Promise<RunResult> {
    if (this.executing) {
      throw new BasicError("実行中です");
    }
    this.resetVariables();
    this.programError = null;
    this.compile(source);
    this.pc = 0;
    if (start !== undefined) {
      this.jump(start);
    }
    return this.execute();
  }
  async immediate(command: string, source = ""): Promise<RunResult> {
    if (this.executing) {
      throw new BasicError("実行中です");
    }
    // Reuse the parser, but keep direct statements outside the stored program.
    const direct = new Basic();
    direct.compile("0 " + command);
    this.programError = null;
    try {
      this.compile(source);
    } catch (error) {
      // An unfinished editor must not prevent independent direct commands.
      this.compile("");
      this.programError = error;
    }
    const prefix: typeof this.code = direct.code.map((line) => ({
      number: null,
      text: line.text,
    }));
    prefix.push({ number: null, text: "END" });
    for (const [label, destination] of Object.entries(this.labels)) {
      if (destination !== undefined) {
        this.labels[label] = destination + prefix.length;
      }
    }
    this.code = prefix.concat(this.code);
    this.pc = 0;
    if (this.dataPos === undefined) {
      this.dataPos = 0;
    }
    return this.execute();
  }
  pace(text: string): Promise<void> | null {
    const speed = this.io.speed?.() ?? 0;
    const now = (this.io.now || (() => performance.now()))();
    if (!(speed > 0)) {
      this.paceDebt = 0;
      this.paceTime = now;
      return null;
    }
    const elapsed = Math.max(0, now - (this.paceTime ?? now));
    this.paceTime = now;
    // Approximate BASIC work units, not CPU-cycle emulation or measured hardware timings.
    const cost = /^(?:REM\b|'|DATA\b)/i.test(text)
      ? 0
      : /^PAINT\b/i.test(text)
        ? 16
        : /^(?:LINE(?!\s+INPUT)|CIRCLE)\b/i.test(text)
          ? 8
          : /^(?:PRINT\b|\?)/i.test(text)
            ? 2
            : 1;
    this.paceDebt = Math.max(0, (this.paceDebt || 0) - elapsed) + cost / speed;
    if (this.paceDebt < 12) {
      return null;
    }
    return this.sleep(Math.min(50, this.paceDebt));
  }
  async execute(): Promise<RunResult> {
    this.executing = true;
    this.stopped = false;
    this.stack = [];
    this.loops = [];
    this.whiles = [];
    let ticks = 0;
    this.paceDebt = 0;
    this.paceTime = undefined;
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
              "Syntax error" +
                (line.number === null ? "" : " in " + line.number),
              "SYNTAX",
            );
          }
          throw new BasicError(
            (line.number === null ? "" : line.number + "行: ") +
              (e instanceof Error ? e.message : String(e)),
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
  async statement(statementSource: string): Promise<void> {
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
    if ((match = statementSource.match(/^IF\s+(.+?)\s+THEN\s+(.+)$/i))) {
      const at = keywordAt(match[2], "ELSE");
      const branches =
        at < 0 ? [match[2]] : [match[2].slice(0, at), match[2].slice(at + 4)];
      const branch = this.expression(match[1]) ? branches[0] : branches[1];
      if (branch) {
        if (/^(?:\d+|\*[A-Z][A-Z0-9_]*)$/i.test(branch.trim())) {
          this.jump(branch.trim());
        } else {
          for (const part of splitOutside(branch, ":").filter(
            (_, i) => i % 2 === 0,
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
    if ((match = statementSource.match(/^(?:PRINT\b|\?)(.*)$/i))) {
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
    if ((match = statementSource.match(/^SLEEP\s+(.+)$/i))) {
      const ms = this.expression(match[1]);
      if (
        typeof ms !== "number" ||
        !Number.isFinite(ms) ||
        ms < 0 ||
        ms > 60000
      ) {
        throw new BasicError("SLEEPは0〜60000ミリ秒で指定してください");
      }
      await this.sleep(ms);
      return;
    }
    if ((match = statementSource.match(/^CLS(?:\s+(.+))?$/i))) {
      const mode = match[1] === undefined ? 1 : this.expression(match[1]);
      if (
        typeof mode !== "number" ||
        !Number.isInteger(mode) ||
        mode < 1 ||
        mode > 3
      ) {
        throw new BasicError("CLSの引数は1・2・3で指定してください");
      }
      this.io.clear?.(mode);
      return;
    }
    if (/^(END|STOP)$/i.test(statementSource)) {
      this.pc = this.code.length;
      return;
    }
    if ((match = statementSource.match(/^GOTO\s+(\d+|\*[A-Z][A-Z0-9_]*)$/i))) {
      this.jump(match[1]);
      return;
    }
    if ((match = statementSource.match(/^GOSUB\s+(\d+|\*[A-Z][A-Z0-9_]*)$/i))) {
      this.stack.push(this.pc);
      this.jump(match[1]);
      return;
    }
    if (/^RETURN$/i.test(statementSource)) {
      if (!this.stack.length) {
        throw new BasicError("GOSUBのないRETURNです");
      }
      this.pc = this.stack.pop()!;
      return;
    }
    if (
      (match = statementSource.match(
        /^FOR\s+([A-Z]\w*[%!#]?)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i,
      ))
    ) {
      const name = match[1].toUpperCase(),
        start = this.numberExpression(match[2]),
        end = this.numberExpression(match[3]),
        step = match[4] ? this.numberExpression(match[4]) : 1;
      if (!step) {
        throw new BasicError("STEPは0にできません");
      }
      this.assign(name, start);
      if (step > 0 ? start > end : start < end) {
        let depth = 1;
        while (this.pc < this.code.length && depth) {
          const t = this.code[this.pc++].text;
          if (/^FOR\b/i.test(t)) {
            depth++;
          }
          if (/^NEXT\b/i.test(t)) {
            const names = t.replace(/^NEXT\s*/i, "").split(",");
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
          throw new BasicError("NEXTがありません");
        }
      } else {
        this.loops.push({ name, end, step, pc: this.pc });
      }
      return;
    }
    if ((match = statementSource.match(/^NEXT(?:\s+([A-Z]\w*[%!#]?))?$/i))) {
      const loop = this.loops.at(-1);
      if (!loop || (match[1] && match[1].toUpperCase() !== loop.name)) {
        throw new BasicError("FORとNEXTが対応していません");
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
    if (
      (match = statementSource.match(/^INPUT\s+(?:"([^"]*)"\s*;\s*)?(.+)$/i))
    ) {
      const targets = splitOutside(match[2], ",").filter((_, i) => i % 2 === 0);
      const answer = await this.io.input?.(match[1] || "? ");
      if (this.stopped) {
        return;
      }
      const values = splitOutside(answer || "", ",").filter(
        (_, i) => i % 2 === 0,
      );
      if (values.length !== targets.length) {
        throw new BasicError("入力値の数が一致しません");
      }
      targets.forEach((t, i) => {
        const v = values[i].trim();
        if (this.typeOf(t.trim().split("(")[0].toUpperCase()) === "$") {
          this.assign(t, v.replace(/^"(.*)"$/, "$1"));
        } else {
          if (v === "" || !Number.isFinite(Number(v))) {
            throw new BasicError("数値を入力してください");
          }
          this.assign(t, Number(v));
        }
      });
      return;
    }
    if ((match = statementSource.match(/^DIM\s+(.+)$/i))) {
      for (const p of splitOutside(match[1], ",").filter(
        (_, i) => i % 2 === 0,
      )) {
        const d = p.match(/^\s*([A-Z]\w*[$%!#]?)\((.*)\)\s*$/i);
        if (!d) {
          throw new BasicError("DIMの書式が不正です");
        }
        const dims = d[2].split(",").map((x) => this.numberExpression(x));
        if (dims.some((x) => !Number.isInteger(x) || x < this.base)) {
          throw new BasicError("配列の大きさが不正です");
        }
        if (this.arrays[d[1].toUpperCase()]) {
          throw new BasicError("配列はすでに定義されています");
        }
        this.arrays[d[1].toUpperCase()] = dims;
      }
      return;
    }
    if ((match = statementSource.match(/^READ\s+(.+)$/i))) {
      if (this.programError) {
        throw this.programError;
      }
      for (const t of splitOutside(match[1], ",").filter(
        (_, i) => i % 2 === 0,
      )) {
        if (this.dataPos >= this.data.length) {
          throw new BasicError("DATAが足りません");
        }
        this.assign(t, this.data[this.dataPos++]);
      }
      return;
    }
    if (
      (match = statementSource.match(
        /^RESTORE(?:\s+(\d+|\*[A-Z][A-Z0-9_]*))?$/i,
      ))
    ) {
      if (this.programError) {
        throw this.programError;
      }
      let line: string | number | undefined = match[1];
      if (typeof line === "string" && line.startsWith("*")) {
        const key = line.toUpperCase();
        line = this.labelLines[key];
        if (line === undefined) {
          throw new BasicError("ラベルがありません: " + key);
        }
      }
      this.dataPos =
        line === undefined
          ? 0
          : (this.dataLines.find((l) => l.number >= Number(line))?.index ??
            this.data.length);
      return;
    }
    if ((match = statementSource.match(/^COLOR\s+(.+)$/i))) {
      this.io.color?.(this.numberExpression(argumentsOf(match[1])[0]));
      return;
    }
    if ((match = statementSource.match(/^LOCATE\s+(.+)$/i))) {
      const a = argumentsOf(match[1]).map((x) => this.numberExpression(x));
      this.io.locate?.(a[0], a[1]);
      return;
    }
    if (
      (match = statementSource.match(
        /^PSET\s*\((.+?),(.+?)\)(?:\s*,\s*(.+))?$/i,
      ))
    ) {
      this.io.pset?.(
        this.numberExpression(match[1]),
        this.numberExpression(match[2]),
        match[3] ? this.numberExpression(match[3]) : undefined,
      );
      return;
    }
    if (
      (match = statementSource.match(
        /^LINE\s*\((.+?),(.+?)\)\s*-\s*\((.+?),(.+?)\)(?:\s*,\s*([^,]+))?(?:\s*,\s*(BF|B))?$/i,
      ))
    ) {
      this.io.line?.(
        this.numberExpression(match[1]),
        this.numberExpression(match[2]),
        this.numberExpression(match[3]),
        this.numberExpression(match[4]),
        match[5] ? this.numberExpression(match[5]) : undefined,
        match[6]?.toUpperCase(),
      );
      return;
    }
    if (
      (match = statementSource.match(
        /^CIRCLE\s*\((.+?),(.+?)\)\s*,\s*([^,]+)(?:\s*,\s*(.+))?$/i,
      ))
    ) {
      this.io.circle?.(
        this.numberExpression(match[1]),
        this.numberExpression(match[2]),
        this.numberExpression(match[3]),
        match[4] ? this.numberExpression(match[4]) : undefined,
      );
      return;
    }
    if (
      /^SCREEN\s+[0-9, ]+$/i.test(statementSource) ||
      /^WIDTH\s+[0-9, ]+$/i.test(statementSource)
    ) {
      return;
    }
    if (
      (match = statementSource.match(
        /^(?:LET\s+)?([A-Z_][A-Z_0-9]*[$%!#]?(?:\(.*?\))?)\s*=\s*(.+)$/i,
      ))
    ) {
      this.assign(match[1], this.expression(match[2]));
      return;
    }
    throw new BasicError("Syntax error", "SYNTAX");
  }
}
