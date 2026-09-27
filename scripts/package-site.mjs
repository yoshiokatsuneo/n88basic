import { copyFile, mkdir, rm } from "node:fs/promises";

// Publish only browser assets, never the workspace or development dependencies.
const destination = new URL("../_site/", import.meta.url);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of [
  "index.html",
  "basic.html",
  "reference.html",
  "style.css",
  "app.js",
  "app.js.map",
  "terminal-cursor.js",
  "terminal-cursor.js.map",
  "reference.js",
  "reference.js.map",
]) {
  await copyFile(
    new URL(`../${file}`, import.meta.url),
    new URL(file, destination),
  );
}
