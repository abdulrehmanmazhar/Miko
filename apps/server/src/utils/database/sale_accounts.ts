import { and, eq, isNull } from "drizzle-orm";
import { accounts } from "../../schema/tables.js";
import { database } from "../../services/database.js";

export function requireActiveAccount(
  tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
  accountId: string,
  expectedType: (typeof accounts.$inferSelect)["type"],
  label: string,
): void {
  const account = tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.type, expectedType),
        eq(accounts.isActive, true),
        eq(accounts.isGroup, false),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1)
    .get();

  if (!account) {
    throw new Error(
      `${label} account "${accountId}" must be an active, non-group ${expectedType} account.`,
    );
  }
}
