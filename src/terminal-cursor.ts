const screen = document.getElementById("gameScreen")!;
const textScreen = document.getElementById("textScreen")!;
const inputs = ["command", "inputValue"].map(
  (id) => document.getElementById(id) as HTMLInputElement,
);
// Render editable text on the same 640x400 grid as committed text.
const layer = document.createElement("canvas");
layer.width = 640;
layer.height = 400;
layer.className = "terminal-input-layer";
layer.setAttribute("aria-hidden", "true");
screen.appendChild(layer);
const ctx = layer.getContext("2d")!;
const cells = (value: string) =>
  Array.from(value).reduce((n, c) => n + (c.codePointAt(0)! > 255 ? 2 : 1), 0);
const cursors = new Map<HTMLInputElement, HTMLSpanElement>();
let composing = false,
  frame: number | null = null;
function update() {
  frame = null;
  ctx.clearRect(0, 0, 640, 400);
  textScreen.style.clipPath = "";
  ctx.font = "14px monospace";
  ctx.textBaseline = "top";
  for (const input of inputs) {
    const cursor = cursors.get(input)!;
    const active =
      document.activeElement === input &&
      !input.disabled &&
      !input.closest("form")!.hidden;
    const form = input.closest("form")!;
    if (!form.hidden && !input.disabled) {
      const scale = screen.clientWidth / 640;
      const left = Math.round((parseFloat(form.style.left) * 640) / 100) || 0;
      const top = Math.round((parseFloat(form.style.top) * 400) / 100) || 0;
      const scroll = input.scrollLeft / scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, 640 - left, 16);
      ctx.clip();
      // Hide only committed text underneath the editable row. The graphics
      // plane stays visible through the transparent input canvas.
      const leftPercent = (left / 640) * 100;
      const topPercent = (top / 400) * 100;
      const bottomPercent = ((top + 16) / 400) * 100;
      textScreen.style.clipPath = `polygon(0 0, 100% 0, 100% ${topPercent}%, ${leftPercent}% ${topPercent}%, ${leftPercent}% ${bottomPercent}%, 100% ${bottomPercent}%, 100% 100%, 0 100%)`;
      let col = 0,
        index = 0;
      for (const c of input.value) {
        const width = c.codePointAt(0)! > 255 ? 16 : 8;
        const selected =
          active &&
          index < (input.selectionEnd ?? 0) &&
          index + c.length > (input.selectionStart ?? 0);
        if (selected) {
          ctx.fillStyle = "#fff";
          ctx.fillRect(left + col - scroll, top, width, 16);
        }
        ctx.fillStyle = selected ? "#000" : "#fff";
        ctx.fillText(c, left + col - scroll, top, width);
        col += width;
        index += c.length;
      }
      ctx.restore();
    }
    cursor.hidden =
      !active ||
      composing ||
      (input.selectionStart ?? 0) !== (input.selectionEnd ?? 0) ||
      !document.hasFocus();
    if (cursor.hidden) {
      continue;
    }
    const cell = screen.clientWidth / 80;
    const offset =
      cells(input.value.slice(0, input.selectionStart ?? 0)) * cell -
      input.scrollLeft;
    const next =
      Array.from(input.value.slice(input.selectionStart ?? 0))[0] || " ";
    const width = next.codePointAt(0)! > 255 ? cell * 2 : cell;
    cursor.style.left =
      Math.max(0, Math.min(input.clientWidth - width, offset)) + "px";
    cursor.style.width = width + "px";
  }
}
function schedule() {
  if (!frame) {
    frame = requestAnimationFrame(update);
  }
}
for (const input of inputs) {
  const cursor = document.createElement("span");
  cursor.className = "terminal-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.hidden = true;
  input.closest("form")!.appendChild(cursor);
  cursors.set(input, cursor);
  for (const event of [
    "input",
    "focus",
    "blur",
    "keydown",
    "keyup",
    "click",
    "scroll",
    "select",
    "compositionupdate",
  ]) {
    input.addEventListener(event, schedule);
  }
  input.addEventListener("compositionstart", () => {
    composing = true;
    input.classList.add("composing");
    schedule();
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    input.classList.remove("composing");
    schedule();
  });
}
document.addEventListener("selectionchange", schedule);
window.addEventListener("focus", schedule);
window.addEventListener("blur", schedule);
new ResizeObserver(schedule).observe(screen);
new MutationObserver((records) => {
  if (
    records.some(
      (r) =>
        inputs.some((input) => input === r.target) ||
        inputs.some((input) => input.closest("form") === r.target),
    )
  ) {
    schedule();
  }
}).observe(screen, {
  subtree: true,
  attributes: true,
  attributeFilter: ["hidden", "disabled"],
});
document.addEventListener("terminal-layout", schedule);
document.fonts?.ready.then(schedule).catch(schedule);
screen.classList.add("canvas-input-ready");
schedule();

export {};
