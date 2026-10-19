#!/usr/bin/env node
/**
 * Local PostgreSQL helper for development.
 *
 * The project targets PostgreSQL and ships a Docker Compose stack for
 * deployment. This script provides a *development-only* PostgreSQL that runs
 * entirely as the current user (no root, no system packages), which is useful
 * on machines where Docker or a system PostgreSQL is unavailable.
 *
 * The server binaries come from the pinned `@embedded-postgres/linux-x64`
 * devDependency, so `npm install` is the only prerequisite.
 *
 * Usage:
 *   node scripts/local-db.mjs start     # initialise (once) + start
 *   node scripts/local-db.mjs stop      # stop the server
 *   node scripts/local-db.mjs status    # print the state
 *   node scripts/local-db.mjs url       # print only the connection URL
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_ROOT = path.join(ROOT, "node_modules", "@embedded-postgres", "linux-x64");
const NATIVE_DIR = path.join(PACKAGE_ROOT, "native");
const BIN_DIR = path.join(NATIVE_DIR, "bin");
const LIB_DIR = path.join(NATIVE_DIR, "lib");

const DATA_DIR = process.env.LOCAL_PG_DATA_DIR
  ? path.resolve(process.env.LOCAL_PG_DATA_DIR)
  : path.join(os.homedir(), ".local", "share", "medical-store", "pgdata");
const LOG_FILE = path.join(os.homedir(), ".local", "share", "medical-store", "postgres.log");
const PORT = Number(process.env.LOCAL_PG_PORT ?? 5432);
const DB_NAME = process.env.LOCAL_PG_DATABASE ?? "medical_store";
const DB_USER = process.env.LOCAL_PG_USER ?? "medical_store";
const DB_PASSWORD = process.env.LOCAL_PG_PASSWORD ?? "medical_store";

const CONNECTION_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${PORT}/${DB_NAME}?schema=public`;

function log(message) {
  process.stdout.write(`${message}\n`);
}

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    encoding: "utf8",
    env: { ...process.env, LD_LIBRARY_PATH: LIB_DIR },
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${path.basename(bin)} failed: ${result.stderr || result.stdout || `exit ${result.status}`}`,
    );
  }
  return result.stdout ?? "";
}

function ensureBinaries() {
  if (!fs.existsSync(path.join(BIN_DIR, "pg_ctl"))) {
    throw new Error(
      "PostgreSQL binaries are missing. Run `npm install` first (the @embedded-postgres/linux-x64 devDependency provides them).",
    );
  }
  // The package's postinstall creates the shared-library symlinks. npm may skip
  // install scripts, so create them on demand.
  const symlinksFile = path.join(NATIVE_DIR, "pg-symlinks.json");
  if (fs.existsSync(symlinksFile)) {
    const entries = JSON.parse(fs.readFileSync(symlinksFile, "utf8"));
    for (const entry of entries) {
      const source = path.join(PACKAGE_ROOT, entry.source);
      const target = path.join(PACKAGE_ROOT, entry.target);
      if (fs.existsSync(source) && !fs.existsSync(target)) {
        fs.symlinkSync(path.relative(path.dirname(target), source), target);
      }
    }
  }
}

function ensureCluster() {
  if (fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) return;
  log("Initialising the local PostgreSQL cluster ...");
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  const pwFile = path.join(os.tmpdir(), `pg-pwfile-${process.pid}`);
  fs.writeFileSync(pwFile, DB_PASSWORD, { mode: 0o600 });
  try {
    run(path.join(BIN_DIR, "initdb"), [
      "-D",
      DATA_DIR,
      "-U",
      DB_USER,
      "--auth-local=trust",
      "--auth-host=trust",
      `--pwfile=${pwFile}`,
      "-E",
      "UTF8",
    ]);
  } finally {
    fs.rmSync(pwFile, { force: true });
  }
}

function isRunning() {
  if (!fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) return false;
  const result = spawnSync(path.join(BIN_DIR, "pg_ctl"), ["-D", DATA_DIR, "status"], {
    encoding: "utf8",
    env: { ...process.env, LD_LIBRARY_PATH: LIB_DIR },
  });
  return result.status === 0;
}

async function ensureDatabase() {
  const { Client } = await import("pg");
  const admin = new Client({
    connectionString: `postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${PORT}/postgres`,
  });
  await admin.connect();
  try {
    const result = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
    if (result.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${DB_NAME}"`);
      log(`Database ${DB_NAME} created.`);
    }
  } finally {
    await admin.end();
  }
}

async function start() {
  ensureBinaries();
  ensureCluster();

  if (!isRunning()) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    run(path.join(BIN_DIR, "pg_ctl"), [
      "-D",
      DATA_DIR,
      "-l",
      LOG_FILE,
      "-o",
      `-p ${PORT} -k ${DATA_DIR} -c listen_addresses=127.0.0.1`,
      "-w",
      "start",
    ]);
    log(`PostgreSQL started on 127.0.0.1:${PORT}.`);
  } else {
    log("PostgreSQL is already running.");
  }

  await ensureDatabase();
  log(`DATABASE_URL="${CONNECTION_URL}"`);
}

function stop() {
  ensureBinaries();
  if (!isRunning()) {
    log("PostgreSQL was not running.");
    return;
  }
  run(path.join(BIN_DIR, "pg_ctl"), ["-D", DATA_DIR, "-m", "fast", "stop"]);
  log("PostgreSQL stopped.");
}

function status() {
  ensureBinaries();
  log(isRunning() ? `running on 127.0.0.1:${PORT}` : "stopped");
}

function url() {
  log(CONNECTION_URL);
}

const command = process.argv[2] ?? "status";
switch (command) {
  case "start":
    await start();
    break;
  case "stop":
    stop();
    break;
  case "status":
    status();
    break;
  case "url":
    url();
    break;
  default:
    log(`Unknown command: ${command}`);
    process.exitCode = 1;
}

export { CONNECTION_URL, execFileSync };
