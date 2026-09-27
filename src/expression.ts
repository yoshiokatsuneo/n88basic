import { BasicError } from "./errors.js";
import type { BasicIO, BasicValue } from "./types.js";

/** The parser depends on values and I/O, not interpreter execution state. */
export interface ExpressionContext {
  readonly io: BasicIO;
  get(name: string): BasicValue;
  call(name: string, args: BasicValue[]): BasicValue;
  random(value?: number): number;
}
export function evaluateExpression(
  source: string,
  context: ExpressionContext,
): BasicValue {
  const tokens = tokenize(source);
  let i = 0;
  const peek = () => {
    const token = tokens[i];
    return token?.kind === "symbol" ? token.value : "";
  };
  const take = (): Token => {
    const token = tokens[i++];
    if (!token) {
      throw new BasicError("式が足りません");
    }
    return token;
  };
  const expect = (v: string) => {
    if (peek() !== v) {
      throw new BasicError(v + " が必要です");
    }
    i++;
  };
  const parsePrimary = (): BasicValue => {
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
      return token.value === "-"
        ? -Number(v)
        : token.value === "NOT"
          ? ~Number(v)
          : +v;
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
        return new Date().toTimeString().slice(0, 8);
      }
      if (token.value === "DATE$") {
        const d = new Date();
        return [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, "0"),
          String(d.getDate()).padStart(2, "0"),
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
    throw new BasicError("不正な式です");
  };
  const precedence: Record<string, number> = {
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
    "^": 8,
  };
  const parseExpression = (min: number): BasicValue => {
    let left = parsePrimary();
    while (peek() in precedence && precedence[peek()] >= min) {
      const operator = peek();
      take();
      const p = precedence[operator],
        right = parseExpression(operator === "^" ? p : p + 1);
      switch (operator) {
        case "+":
          left =
            typeof left === "string" || typeof right === "string"
              ? String(left) + String(right)
              : left + right;
          break;
        case "-":
          left = Number(left) - Number(right);
          break;
        case "*":
          left = Number(left) * Number(right);
          break;
        case "/":
          if (right === 0) {
            throw new BasicError("0で割ることはできません");
          }
          left = Number(left) / Number(right);
          break;
        case "\\":
          if (right === 0) {
            throw new BasicError("0で割ることはできません");
          }
          left = Math.trunc(Number(left) / Number(right));
          break;
        case "MOD":
          if (right === 0) {
            throw new BasicError("0で割ることはできません");
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
            ">=": left >= right,
          }[operator]
            ? -1
            : 0;
      }
    }
    return left;
  };
  const value = parseExpression(-2);
  if (i !== tokens.length) {
    throw new BasicError("式の末尾が不正です");
  }
  return value;
}

type Token =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "string" | "symbol"; readonly value: string };
function tokenize(source: string): Token[] {
  const tokenPattern =
    /\s*(?:(&[Hh][0-9A-Fa-f]+|&[Oo][0-7]+|[0-9]+(?:\.[0-9]*)?(?:E[+-]?\d+)?|\.[0-9]+)|("[^"]*")|([A-Za-z_][A-Za-z_0-9]*[$%!#]?)|(<>|<=|>=|[+\-*/\\^=<>(),]))/gy;
  const tokens: Token[] = [];
  let position = 0;
  while (position < source.length) {
    if (!source.slice(position).trim()) {
      break;
    }
    tokenPattern.lastIndex = position;
    const match = tokenPattern.exec(source);
    if (!match) {
      throw new BasicError("式を解釈できません: " + source.slice(position));
    }
    tokens.push(
      match[1] !== undefined
        ? {
            kind: "number",
            value: /^&H/i.test(match[1])
              ? parseInt(match[1].slice(2), 16)
              : /^&O/i.test(match[1])
                ? parseInt(match[1].slice(2), 8)
                : Number(match[1]),
          }
        : match[2] !== undefined
          ? { kind: "string", value: match[2].slice(1, -1) }
          : {
              kind: "symbol",
              value: (match[3] ?? match[4] ?? "").toUpperCase(),
            },
    );
    position = tokenPattern.lastIndex;
  }
  return tokens;
}
