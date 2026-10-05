// @ts-nocheck
import { defineConfig } from "drizzle-kit";
import { databasePath } from "./src/utils/paths/index.js";
import { pathToFileURL } from "url";

export default defineConfig({
  schema: "./src/schema/tables.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: pathToFileURL(databasePath).href,
  },
});
