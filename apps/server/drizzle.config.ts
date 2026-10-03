import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/tables.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:./.drizzle.db",
  },
});
