#!/usr/bin/env node
// npm needs a recognized extension for `bin` entries. Under Bun this file
// imports the TypeScript entry in-process. Under Node, --help/--version skip
// the spawn; real commands still launch Bun because fetch uses the tls option.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const VERSION = "0.6.0";
const HELP = `metaprev v${VERSION} — preview your OpenGraph cards locally

Usage:
  metaprev <url> [options]              # full preview + browser open
  metaprev issues <url> [options]       # print just the issues
  metaprev facts  <url> [options]       # print just the parsed meta facts

Arguments:
  url                URL to fetch (e.g. https://example.com or http://localhost:3000)

Options:
  -o, --output FILE  Write the preview HTML to FILE (preview command only)
  --no-open          Don't auto-open the preview in your browser
  --json             Print machine-readable JSON to stdout (implies --no-open)
  -k, --insecure     Skip TLS cert verification (auto-on for *.localhost / *.test / 127.0.0.1)
  -v, --version      Print version and exit
  -h, --help         Show this help

Examples:
  metaprev http://localhost:3000            # check your local dev server
  metaprev https://hungv.io                 # check a deployed page
  metaprev issues http://localhost:3000     # quick issue check, no browser
  metaprev facts https://hungv.io --json    # pipe parsed meta into another tool
`;

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "metaprev.ts");
const bun = process.env.METAPREV_BUN || "bun";
const argv = process.argv.slice(2);
const only = argv.length === 1 ? argv[0] : undefined;

if (process.versions.bun) {
  await import("./metaprev.ts");
} else if (only === "-h" || only === "--help") {
  console.log(HELP);
} else if (only === "-v" || only === "--version") {
  console.log(VERSION);
} else {
  const child = spawn(bun, [entry, ...argv], { stdio: "inherit" });

  child.on("error", (err) => {
    if (err && err.code === "ENOENT") {
      console.error("metaprev: requires `bun` on PATH (https://bun.sh/install).");
      process.exit(127);
    }
    console.error("metaprev: failed to spawn bun:", err.message);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}
