import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { databasePath, migrationsPath } from "../utils/paths/index.js";
import { installActionRecorder } from "../utils/action_recorder/index.js";

mkdirSync(dirname(databasePath), { recursive: true });

const client = new DatabaseSync(databasePath);

export const database = drizzle({ client });

const runMigrations = () => {
  migrate(database, { migrationsFolder: migrationsPath });
};

export const connectDatabase = () => {
  try {
    database.run(sql`SELECT 1`);
    runMigrations();
    installActionRecorder(database, "action_records");
  } catch (error) {
    console.error("Error connecting to database:", error);
    throw error;
  }
};
