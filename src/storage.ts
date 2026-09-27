/** Validate external data before exposing it to the interpreter. */
export function parsePrograms(
  serialized: string | null,
): Record<string, string> {
  if (serialized === null) {
    return {};
  }
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("保存データを読み取れません。JSONの形式が不正です。");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      "保存データはプログラム名とコードの一覧である必要があります。",
    );
  }
  const programs: Record<string, string> = {};
  for (const [name, source] of Object.entries(value)) {
    if (typeof source !== "string") {
      throw new Error(`保存データ「${name}」のコードが文字列ではありません。`);
    }
    // Names such as __proto__ are valid filenames, never prototype mutations.
    Object.defineProperty(programs, name, {
      value: source,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return programs;
}

export function readPrograms(
  storage: Pick<Storage, "getItem">,
): Record<string, string> {
  return parsePrograms(storage.getItem("n88-programs"));
}

export function writePrograms(
  storage: Pick<Storage, "setItem">,
  programs: Record<string, string>,
): void {
  storage.setItem("n88-programs", JSON.stringify(programs));
}
