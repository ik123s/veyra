import { createInsertSchema } from "drizzle-zod";
import { bigint, check, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { fintechProfilesTable } from "./fintech-profiles";

export const fintechWalletsTable = pgTable(
  "fintech_wallets",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => fintechProfilesTable.id, { onDelete: "cascade" }),
    balance: bigint("balance", { mode: "number" }).notNull().default(50000),
  },
  (table) => [check("fintech_wallets_nonnegative_balance", sql`${table.balance} >= 0`)],
);

export const insertFintechWalletSchema = createInsertSchema(
  fintechWalletsTable,
);
export type InsertFintechWallet = z.infer<typeof insertFintechWalletSchema>;
export type FintechWallet = typeof fintechWalletsTable.$inferSelect;