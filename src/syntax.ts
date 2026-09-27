export function splitOutside(source: string, separator: string) {
  let quoted = false,
    depth = 0,
    start = 0;
  const parts: string[] = [];
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
export function argumentsOf(source: string) {
  return splitOutside(source, ",").filter((_, i) => i % 2 === 0);
}
export function keywordAt(source: string, word: string) {
  let quote = false,
    depth = 0;
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
    if (
      !depth &&
      source.slice(i, i + word.length).toUpperCase() === word &&
      !/[A-Z0-9_$]/i.test(source[i - 1] || "") &&
      !/[A-Z0-9_$]/i.test(source[i + word.length] || "")
    ) {
      return i;
    }
  }
  return -1;
}
