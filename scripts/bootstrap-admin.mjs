#!/usr/bin/env node
/**
 * Interactive wrapper around `scripts/bootstrap-admin.ts`.
 *
 * Prompts for the administrator details and password, then pipes the password
 * to the TypeScript script over standard input so that it never appears in a
 * command line or in a file.
 *
 * Usage:
 *   node scripts/bootstrap-admin.mjs --email you@example.com --name "Your Name"
 *   node scripts/bootstrap-admin.mjs --generate            # random password, shown once
 *   node scripts/bootstrap-admin.mjs --password-stdin      # password on stdin
 */

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

function parseArgs(argv) {
  const args = { flags: new Set(), values: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const name = item.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.values[name] = next;
      i += 1;
    } else {
      args.flags.add(name);
    }
  }
  return args;
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let hidden = "";
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      if (text === "\u0003") {
        stdout.write("\n");
        process.exit(130);
      }
      if (text === "\r" || text === "\n") {
        stdout.write("\n");
        stdin.setRawMode(false);
        stdin.pause();
        resolve(hidden);
        return;
      }
      for (const char of text) {
        if (char >= " ") hidden += char;
      }
    });
    stdin.on("error", reject);
  });
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env and set it.");
    process.exit(1);
  }

  const email = args.values.email ?? (await prompt("Administrator email: "));
  const fullName = args.values.name ?? (await prompt("Administrator full name: "));

  let password;
  let generated = false;

  if (args.flags.has("generate")) {
    password = `${crypto.randomBytes(18).toString("base64url")}A1!`;
    generated = true;
  } else if (args.flags.has("password-stdin")) {
    password = fs.readFileSync(0, "utf8").trim();
  } else if (process.stdin.isTTY) {
    const first = await promptHidden("Administrator password: ");
    const second = await promptHidden("Confirm password: ");
    if (first !== second) {
      console.error("The passwords do not match.");
      process.exit(1);
    }
    password = first;
  } else {
    console.error(
      "stdin is not a terminal. Use --password-stdin, --generate, or run this command from an interactive shell.",
    );
    process.exit(1);
  }

  const child = spawn(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      path.join(ROOT, "scripts", "bootstrap-admin.ts"),
      "--email",
      email,
      "--name",
      fullName,
    ],
    { cwd: ROOT, env: process.env, stdio: ["pipe", "inherit", "inherit"] },
  );

  child.stdin.write(`${password}\n`);
  child.stdin.end();

  const code = await new Promise((resolve) => {
    child.on("close", (exitCode) => resolve(exitCode ?? 1));
  });

  if (generated && code === 0) {
    console.log("");
    console.log("Generated administrator password (shown once):");
    console.log(`  ${password}`);
  }

  process.exit(code);
}

await main();
