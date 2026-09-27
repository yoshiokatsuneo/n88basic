import { build, context } from "esbuild";
import { spawn } from "node:child_process";

// Source modules stay reusable in Node. Browser bundles also work from file://.
const options = {
  entryPoints: ["src/app.ts", "src/terminal-cursor.ts", "src/reference.ts"],
  outdir: ".",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  banner: { js: "// Generated from src/*.ts. Do not edit directly." },
};

if (process.argv.includes("--watch")) {
  const compiler = spawn(
    process.execPath,
    ["node_modules/typescript/bin/tsc", "--watch"],
    { stdio: "inherit" },
  );
  const bundler = await context(options);
  await bundler.watch();
  const stop = async () => {
    compiler.kill();
    await bundler.dispose();
    process.exit();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
} else {
  await build(options);
}
