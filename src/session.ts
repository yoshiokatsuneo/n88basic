import { parseProgramLines } from "./program-lines.js";
import type { Basic } from "./basic.js";
import type { SessionIO, CommandResult } from "./types.js";
export class Session {
  programs: Record<string, string> = {};
  constructor(
    public readonly basic: Basic,
    public readonly io: SessionIO,
  ) {}
  lines(): [number, string][] {
    return parseProgramLines(this.io.getSource());
  }
  renumber(args: string): CommandResult {
    const parts = args.split(",").map((v) => v.trim());
    if (parts.length > 3 || parts.some((v) => v && !/^\d+$/.test(v))) {
      throw new Error(
        "RENUM [新行番号],[旧開始行番号],[増分] の書式で指定してください",
      );
    }
    const [start, from, step] = [0, 1, 2].map((i) =>
      parts[i] ? Number(parts[i]) : [10, 0, 10][i],
    );
    if (
      ![start, from, step].every(Number.isSafeInteger) ||
      start < 1 ||
      from < 0 ||
      step < 1 ||
      Math.max(start, from, step) > 65529
    ) {
      throw new Error("RENUMの行番号・増分が範囲外です");
    }
    const lines = this.lines(),
      map = new Map<number, number>();
    let next = start,
      previous = -1;
    for (const [n] of lines) {
      const updated = n < from ? n : next;
      if (n >= from) {
        next += step;
      }
      if (updated <= previous || updated > 65529) {
        throw new Error("RENUMで行番号が重複・逆転するか65529を超えます");
      }
      previous = updated;
      map.set(n, updated);
    }
    const rewrite = (text: string) => {
      // Tokenize before rewriting: quoted strings, REM and DATA are not code references.
      const tokens =
        text.match(
          /"[^"]*"|'[^\n]*|[A-Za-z_][A-Za-z_0-9]*[$%!#]?|\d+(?:\.\d*)?|\s+|./g,
        ) || [];
      let data = false,
        expect = false,
        list = false;
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i],
          upper = token.toUpperCase();
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
            throw new Error("RENUM: 参照先の行番号がありません: " + old);
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
        if (
          [
            "GOTO",
            "GOSUB",
            "THEN",
            "ELSE",
            "RESTORE",
            "RUN",
            "RESUME",
            "RETURN",
          ].includes(upper)
        ) {
          expect = true;
          list = upper === "GOTO" || upper === "GOSUB";
        }
      }
      return tokens.join("");
    };
    const source = lines
      .map(([n, text]) => map.get(n) + " " + rewrite(text))
      .join("\n");
    this.io.setSource(source);
    this.basic.resetVariables();
    return { kind: "edit" };
  }
  async submit(command: string): Promise<CommandResult> {
    if (this.basic.executing) {
      throw new Error("実行中です。先に停止してください");
    }
    const s = command.trim();
    if (!s) {
      return { kind: "empty" };
    }
    if (/[\r\n]/.test(s)) {
      throw new Error("即時モードには1行ずつ入力してください");
    }
    let m;
    if ((m = s.match(/^(\d+)\s*(.*)$/))) {
      const n = Number(m[1]);
      if (!Number.isSafeInteger(n)) {
        throw new Error("行番号が大きすぎます");
      }
      const lines = new Map(this.lines());
      if (m[2]) {
        lines.set(n, m[2]);
      } else {
        lines.delete(n);
      }
      this.io.setSource(
        [...lines]
          .sort((a, b) => a[0] - b[0])
          .map(([n, text]) => n + " " + text)
          .join("\n"),
      );
      this.basic.resetVariables();
      return { kind: "edit", silent: true };
    }

    if ((m = s.match(/^(SAVE|LOAD|MERGE)\s+"([^"]+)"(?:\s*,\s*([AR]))?$/i))) {
      const action = m[1].toUpperCase(),
        name = m[2],
        option = m[3]?.toUpperCase();
      if (
        option &&
        !(
          (action === "SAVE" && option === "A") ||
          (action === "LOAD" && option === "R")
        )
      ) {
        throw new Error("保存・読込オプションが不正です");
      }
      const programs = this.io.readPrograms
        ? this.io.readPrograms()
        : this.programs;
      if (action === "SAVE") {
        Object.defineProperty(programs, name, {
          value: this.io.getSource(),
          enumerable: true,
          writable: true,
          configurable: true,
        });
        if (this.io.writePrograms) {
          this.io.writePrograms(programs);
        } else {
          this.programs = programs;
        }
        return { kind: "save" };
      }
      if (
        !Object.hasOwn(programs, name) ||
        typeof programs[name] !== "string"
      ) {
        throw new Error("保存したプログラムがありません: " + name);
      }
      const imported = parseProgramLines(programs[name]);
      const lines =
        action === "MERGE" ? new Map(this.lines()) : new Map<number, string>();
      for (const [n, line] of imported) {
        lines.set(n, line);
      }
      this.io.setSource(
        [...lines]
          .sort((a, b) => a[0] - b[0])
          .map(([n, line]) => n + " " + line)
          .join("\n"),
      );
      this.basic.resetVariables();
      if (option === "R") {
        return {
          kind: "run",
          ...(await this.basic.run(this.io.getSource())),
        };
      }
      return { kind: action === "LOAD" ? "load" : "merge" };
    }
    if (/^FILES$/i.test(s)) {
      const programs = this.io.readPrograms
        ? this.io.readPrograms()
        : this.programs;
      for (const name of Object.keys(programs).sort()) {
        this.io.print(name + "\n");
      }
      return { kind: "files" };
    }
    if ((m = s.match(/^DELETE\s+(\d+)?\s*(-)?\s*(\d+)?$/i))) {
      if (!m[1] && !m[3]) {
        throw new Error("削除する行番号を指定してください");
      }
      const from = m[1] === undefined ? 0 : Number(m[1]),
        to = m[2] ? (m[3] === undefined ? Infinity : Number(m[3])) : from;
      if ((m[3] && !m[2]) || from > to) {
        throw new Error("DELETEの範囲が不正です");
      }
      this.io.setSource(
        this.lines()
          .filter(([n]) => n < from || n > to)
          .map(([n, line]) => n + " " + line)
          .join("\n"),
      );
      this.basic.resetVariables();
      return { kind: "edit" };
    }
    if ((m = s.match(/^RENUM(?:\s+(.*))?$/i))) {
      return this.renumber(m[1] || "");
    }
    if ((m = s.match(/^RUN(?:\s+(\d+|\*[A-Z][A-Z0-9_]*))?$/i))) {
      return {
        kind: "run",
        ...(await this.basic.run(
          this.io.getSource(),
          m[1] === undefined ? undefined : m[1],
        )),
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
    if ((m = s.match(/^LIST(?:\s+(\d+)?\s*(-)?\s*(\d+)?)?$/i))) {
      const from = m[1] === undefined ? 0 : Number(m[1]);
      const to = m[2]
        ? m[3] === undefined
          ? Infinity
          : Number(m[3])
        : m[1] === undefined
          ? Infinity
          : from;
      if ((m[3] && !m[2]) || from > to) {
        throw new Error("LISTの範囲が不正です");
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
      ...(await this.basic.immediate(s, this.io.getSource())),
    };
  }
}
