import path, { join } from "path";
import os from "node:os";
import { pathToFileURL, fileURLToPath } from "url";
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

export function getModuleURL(relativePath: string, baseUrl: string): URL {
  const AbsolutePath = path.resolve(
    path.dirname(fileURLToPath(baseUrl)),
    relativePath,
  );
  return pathToFileURL(AbsolutePath);
}

export const serverRoot =
  env.NODE_ENV === "PRODUCTION"
    ? dirname(process.execPath)
    : join(dirname(process.argv[1] as string), "..");

export const migrationsPath = join(serverRoot, "migrations");

export const getTaskModuleURL = (module: string) => {
  let modulePath;
  console.log(env);
  if (env.NODE_ENV !== "PRODUCTION") {
    modulePath = path.join(
      serverRoot,
      "src",
      "task",
      module.split(".").at(1) === "js"
        ? module
            .split(".")
            .map((s) => (s === "js" ? "ts" : s))
            .join(".")
        : module,
    );
  } else {
    modulePath = path.join(serverRoot, "dist", "task", module);
  }
  return pathToFileURL(modulePath).href;
};
