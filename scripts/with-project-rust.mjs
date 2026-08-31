import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cargoHome = path.join(projectRoot, ".local-rust", "cargo");
const rustupHome = path.join(projectRoot, ".local-rust", "rustup");
const localCargoBin = path.join(cargoHome, "bin");
const nodeModulesBin = path.join(projectRoot, "node_modules", ".bin");

const env = { ...process.env };
const pathEntries = [nodeModulesBin];

if (existsSync(localCargoBin)) {
  env.CARGO_HOME = cargoHome;
  env.RUSTUP_HOME = rustupHome;
  pathEntries.unshift(localCargoBin);
}

const existingPath = env.PATH ?? env.Path ?? "";
env.PATH = [...pathEntries, existingPath].join(path.delimiter);
if (process.platform === "win32") {
  env.Path = env.PATH;
}

const commandArgs = process.argv.slice(2);
if (commandArgs.length === 0) {
  console.error("Usage: node scripts/with-project-rust.mjs <command> [...args]");
  process.exit(1);
}

const child = spawn(commandArgs[0], commandArgs.slice(1), {
  cwd: projectRoot,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
