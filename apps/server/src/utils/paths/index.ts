import path, { join } from "path";
import os from "node:os";
import { pathToFileURL } from "url";
import env from "../../config/env.js";
import { dirname } from "node:path";

const appDataPath =
  process.platform === "win32"
    ? join(os.homedir(), "AppData", "Roaming")
    : process.platform === "darwin"
      ? join(os.homedir(), "Library", "Application Support")
      : join(os.homedir(), ".local", "share");

export const appDataRoot = join(appDataPath, env.APP_NAME);

export const databasePath = join(appDataRoot, "database.db");

export const logsPath = join(appDataRoot, "app.log");

export const tempPath = join(appDataRoot, "temp");

export const serverRoot =
  env.NODE_ENV === "PRODUCTION"
    ? join(dirname(process.execPath), "..")
    : join(dirname(process.argv[1] as string), "..");

export const migrationsPath = join(serverRoot, "migrations");
