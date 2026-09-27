/** Parse numbered source without constructing an interpreter or touching storage. */
export function parseProgramLines(source: string): [number, string][] {
  const lines = new Map<number, string>();
  for (const raw of source.split(/\r?\n/)) {
    if (!raw.trim()) {
      continue;
    }
    const match = raw.match(/^\s*(\d+)\s*(.*)$/);
    if (!match || !Number.isSafeInteger(Number(match[1]))) {
      throw new Error("エディタの行番号を確認してください");
    }
    const lineNumber = Number(match[1]);
    if (lines.has(lineNumber)) {
      throw new Error("行番号が重複しています: " + lineNumber);
    }
    lines.set(lineNumber, match[2]);
  }
  return [...lines].sort((a, b) => a[0] - b[0]);
}
