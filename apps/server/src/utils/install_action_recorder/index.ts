import { getTableName, getTableColumns, is, sql, Table } from "drizzle-orm";
import type { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import * as schema from "../../schema/tables.js";

const allSchemaEntries = Object.values(schema);

const tables = allSchemaEntries.filter((entry) => is(entry, Table));

const tableNames = tables.map((table) => getTableName(table));

/**
 * SQLite identifiers cannot be parameterized.
 *
 * These names come from the Drizzle schema, not from user input,
 * but we still quote them correctly.
 */
const quoteIdentifier = (value: string): string => {
  return `"${value.replaceAll('"', '""')}"`;
};

/**
 * Escape a string so it can safely be embedded as a SQLite string literal.
 *
 * These values come from the schema, but this also makes generated SQL
 * easier to reason about.
 */
const quoteString = (value: string): string => {
  return `'${value.replaceAll("'", "''")}'`;
};

/**
 * Generate a UUID v4 directly inside SQLite.
 *
 * SQLite does not have a native UUID() function, so we construct one
 * from randomblob().
 */
const sqliteUuidExpression = (): string => {
  return `
    lower(
  hex(randomblob(4)) || '-' ||
  hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(hex(randomblob(2)), 2) || '-' ||
  hex(randomblob(6))
)
  `;
};

/**
 * SQLite current timestamp in milliseconds since Unix epoch.
 *
 * SQLite's strftime('%s') only has second precision, so julianday()
 * is used here for millisecond precision.
 */
const sqliteTimestampMsExpression = (): string => {
  return `
    CAST(
      (julianday('now') - 2440587.5) * 86400000
      AS INTEGER
    )
  `;
};

/**
 * Create JSON representing a row.
 *
 * Example:
 *
 * json_object(
 *   'id', NEW."id",
 *   'name', NEW."name",
 *   'amount', NEW."amount"
 * )
 */
const createRowJsonExpression = (
  columns: readonly string[],
  rowReference: "NEW" | "OLD",
): string => {
  if (columns.length === 0) {
    throw new Error("Cannot create row JSON without columns");
  }

  const pairs = columns.map((columnName) => {
    return `${quoteString(columnName)}, ${rowReference}.${quoteIdentifier(columnName)}`;
  });

  return `json_object(${pairs.join(", ")})`;
};

/**
 * Extract the primary-key column.
 *
 * V1 deliberately requires:
 *
 *   id TEXT PRIMARY KEY
 */
const getIdColumn = (table: Table): string => {
  const columns = getTableColumns(table);

  const idColumn = Object.entries(columns).find(([propertyName, column]) => {
    const columnName = (column as { name: string }).name;

    return propertyName === "id" || columnName === "id";
  });

  if (!idColumn) {
    throw new Error(
      `Action recorder requires an "id" column on table "${getTableName(table)}"`,
    );
  }

  return (idColumn[1] as { name: string }).name;
};

/**
 * Generate INSERT trigger.
 */
const createInsertTrigger = (
  tableName: string,
  actionRecordTable: string,
  columns: readonly string[],
  idColumn: string,
): string => {
  const triggerName = `_action_recorder_${tableName}_insert`;

  const rowJson = createRowJsonExpression(columns, "NEW");

  return `
    CREATE TEMP TRIGGER IF NOT EXISTS ${quoteIdentifier(triggerName)}
    AFTER INSERT ON ${quoteIdentifier(tableName)}
    BEGIN

      INSERT INTO ${quoteIdentifier(actionRecordTable)} (
        "id",
        "operation_id",
        "sequence",
        "action",
        "table_name",
        "row_id",
        "before",
        "after",
        "context",
        "source_action_id",
        "created_at"
      )
      SELECT
        ${sqliteUuidExpression()},
        operation_id,
        (
          SELECT COALESCE(MAX(sequence), 0) + 1
          FROM ${quoteIdentifier(actionRecordTable)}
          WHERE operation_id = operation_id
        ),
        'insert',
        ${quoteString(tableName)},
        CAST(NEW.${quoteIdentifier(idColumn)} AS TEXT),
        NULL,
        ${rowJson},
        context,
        NULL,
        ${sqliteTimestampMsExpression()}
      FROM _action_context
      ORDER BY id DESC
      LIMIT 1;

    END;
  `;
};

/**
 * Generate UPDATE trigger.
 */
const createUpdateTrigger = (
  tableName: string,
  actionRecordTable: string,
  columns: readonly string[],
  idColumn: string,
): string => {
  const triggerName = `_action_recorder_${tableName}_update`;

  const beforeJson = createRowJsonExpression(columns, "OLD");
  const afterJson = createRowJsonExpression(columns, "NEW");

  return `
    CREATE TEMP TRIGGER IF NOT EXISTS ${quoteIdentifier(triggerName)}
    AFTER UPDATE ON ${quoteIdentifier(tableName)}
    BEGIN

      INSERT INTO ${quoteIdentifier(actionRecordTable)} (
        "id",
        "operation_id",
        "sequence",
        "action",
        "table_name",
        "row_id",
        "before",
        "after",
        "context",
        "source_action_id",
        "created_at"
      )
      SELECT
        ${sqliteUuidExpression()},
        operation_id,
        (
          SELECT COALESCE(MAX(sequence), 0) + 1
          FROM ${quoteIdentifier(actionRecordTable)}
          WHERE operation_id = operation_id
        ),
        'update',
        ${quoteString(tableName)},
        CAST(NEW.${quoteIdentifier(idColumn)} AS TEXT),
        ${beforeJson},
        ${afterJson},
        context,
        NULL,
        ${sqliteTimestampMsExpression()}
      FROM _action_context
      ORDER BY id DESC
      LIMIT 1;

    END;
  `;
};

/**
 * Generate DELETE trigger.
 */
const createDeleteTrigger = (
  tableName: string,
  actionRecordTable: string,
  columns: readonly string[],
  idColumn: string,
): string => {
  const triggerName = `_action_recorder_${tableName}_delete`;

  const beforeJson = createRowJsonExpression(columns, "OLD");

  return `
    CREATE TEMP TRIGGER IF NOT EXISTS ${quoteIdentifier(triggerName)}
    AFTER DELETE ON ${quoteIdentifier(tableName)}
    BEGIN

      INSERT INTO ${quoteIdentifier(actionRecordTable)} (
        "id",
        "operation_id",
        "sequence",
        "action",
        "table_name",
        "row_id",
        "before",
        "after",
        "context",
        "source_action_id",
        "created_at"
      )
      SELECT
        ${sqliteUuidExpression()},
        operation_id,
        (
          SELECT COALESCE(MAX(sequence), 0) + 1
          FROM ${quoteIdentifier(actionRecordTable)}
          WHERE operation_id = operation_id
        ),
        'delete',
        ${quoteString(tableName)},
        CAST(OLD.${quoteIdentifier(idColumn)} AS TEXT),
        ${beforeJson},
        NULL,
        context,
        NULL,
        ${sqliteTimestampMsExpression()}
      FROM _action_context
      ORDER BY id DESC
      LIMIT 1;

    END;
  `;
};

/**
 * Install the TEMP action-context table.
 */
const installActionContextTable = (db: NodeSQLiteDatabase) => {
  db.run(sql`
    CREATE TEMP TABLE IF NOT EXISTS _action_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id TEXT NOT NULL,
      context TEXT NOT NULL,
      source_operation_id TEXT,
      created_at INTEGER NOT NULL
    )
  `);
};

/**
 * Install the action recorder.
 *
 * This:
 *
 * 1. Validates the action log table.
 * 2. Creates the connection-local context table.
 * 3. Generates INSERT/UPDATE/DELETE triggers for every application table.
 */
export const installActionRecorder = (
  db: NodeSQLiteDatabase,
  actionRecordTable: string,
) => {
  if (
    !tableNames.includes(
      actionRecordTable as unknown as (typeof tableNames)[number],
    )
  ) {
    throw new Error(
      `Cannot find the given actions recording table "${actionRecordTable}" in schema`,
    );
  }

  if (actionRecordTable === "_action_context") {
    throw new Error("_action_context cannot be used as the action log table");
  }

  installActionContextTable(db);

  for (const table of tables) {
    const tableName = getTableName(table);

    // Never record the recorder itself.
    if (tableName === actionRecordTable) {
      continue;
    }

    const columns = Object.values(getTableColumns(table)).map(
      (column) => (column as { name: string }).name,
    );

    const idColumn = getIdColumn(table);

    /**
     * Drop existing triggers first.
     *
     * This is useful during development when the schema changes.
     */
    db.run(
      sql.raw(
        `DROP TRIGGER IF EXISTS ${quoteIdentifier(
          `_action_recorder_${tableName}_insert`,
        )}`,
      ),
    );

    db.run(
      sql.raw(
        `DROP TRIGGER IF EXISTS ${quoteIdentifier(
          `_action_recorder_${tableName}_update`,
        )}`,
      ),
    );

    db.run(
      sql.raw(
        `DROP TRIGGER IF EXISTS ${quoteIdentifier(
          `_action_recorder_${tableName}_delete`,
        )}`,
      ),
    );

    db.run(
      sql.raw(
        createInsertTrigger(tableName, actionRecordTable, columns, idColumn),
      ),
    );

    db.run(
      sql.raw(
        createUpdateTrigger(tableName, actionRecordTable, columns, idColumn),
      ),
    );

    db.run(
      sql.raw(
        createDeleteTrigger(tableName, actionRecordTable, columns, idColumn),
      ),
    );
  }
};

/**
 * Push a new logical execution context.
 *
 * This intentionally APPENDS to the TEMP table.
 *
 * We do not expire/delete old contexts.
 */
export const pushActionContext = (
  db: NodeSQLiteDatabase,
  operationId: string,
  context: string,
  sourceOperationId?: string,
) => {
  installActionContextTable(db);

  db.run(sql`
    INSERT INTO _action_context (
      operation_id,
      context,
      source_operation_id,
      created_at
    )
    VALUES (
      ${operationId},
      ${context},
      ${sourceOperationId ?? null},
      ${Date.now()}
    )
  `);
};
