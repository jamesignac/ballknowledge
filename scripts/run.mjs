import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cp } from "node:fs/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] === "start" ? "start" : "dev";
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === "win32")
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    else child.kill("SIGTERM");
  }
  process.exitCode = code;
}
function launch(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env: process.env,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
  return child;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
const apiOrigin =
  process.env.API_ORIGIN || `http://127.0.0.1:${process.env.API_PORT || 8000}`;
process.env.API_ORIGIN = apiOrigin;
if (process.env.EXTERNAL_API !== "1") {
  launch(process.env.PYTHON || "python", [
    "scripts/run_api.py",
    ...(mode === "dev" ? ["--reload"] : []),
  ]);
  const deadline = Date.now() + 180000;
  let ready = false;
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(`${apiOrigin}/api/health`, {
        signal: AbortSignal.timeout(1500),
      });
      ready = response.ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready && !stopping) {
    console.error(
      "The analytics API did not become ready. Check the Python startup output.",
    );
    stop(1);
  }
}
if (!stopping && mode === "start") {
  await cp(
    path.join(root, "public"),
    path.join(root, ".next/standalone/public"),
    { recursive: true },
  );
  await cp(
    path.join(root, ".next/static"),
    path.join(root, ".next/standalone/.next/static"),
    { recursive: true },
  );
  process.env.HOSTNAME = process.env.HOST || "127.0.0.1";
  const portIndex = process.argv.indexOf("--port");
  if (portIndex >= 0) process.env.PORT = process.argv[portIndex + 1];
  launch(process.execPath, [".next/standalone/server.js"]);
} else if (!stopping)
  launch(process.execPath, [
    "node_modules/next/dist/bin/next",
    mode,
    "--hostname",
    process.env.HOST || "127.0.0.1",
    ...process.argv.slice(3),
  ]);
