import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.platform === "win32") {
  // OneDrive directories are cloud reparse points. Native PowerShell handles
  // their removal correctly where Node's recursive build cleanup can fail.
  const cleanup = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `
    $ErrorActionPreference='Stop'
    $expected=[IO.Path]::GetFullPath((Join-Path $env:BK_BUILD_WORKSPACE '.next'))
    if(Test-Path -LiteralPath $expected){
      $resolved=(Resolve-Path -LiteralPath $expected).Path
      if($resolved -ne $expected){throw 'Unexpected generated build directory'}
      Remove-Item -LiteralPath $resolved -Recurse -Force
    }
  `,
    ],
    {
      cwd: root,
      env: { ...process.env, BK_BUILD_WORKSPACE: root },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  if (cleanup.status !== 0) process.exit(cleanup.status || 1);
}
const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build", ...process.argv.slice(2)],
  { cwd: root, env: process.env, stdio: "inherit", windowsHide: true },
);
if(result.error)throw result.error;
process.exit(result.status ?? 1);
