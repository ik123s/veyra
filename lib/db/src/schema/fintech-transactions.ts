import { createInsertSchema } from "drizzle-zod";
import {
  bigint,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { fintechProfilesTable } from "./fintech-profiles";

export const fintechTransactionsTable = pgTable("fintech_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: text("transaction_id").notNull().unique(),
  clientRequestId: uuid("client_request_id").unique(),
  senderUserId: text("sender_user_id").references(() => fintechProfilesTable.id, {
    onDelete: "cascade",
  }),
  recipientUserId: text("recipient_user_id").references(
    () => fintechProfilesTable.id,
    { onDelete: "cascade" },
  ),
  amount: bigint("amount", { mode: "number" }).notNull(),
  transactionType: text("transaction_type").notNull(),
  status: text("status").$type<"completed" | "simulated">().notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertFintechTransactionSchema = createInsertSchema(
  fintechTransactionsTable,
).omit({ id: true, createdAt: true });
export type InsertFintechTransaction = z.infer<
  typeof insertFintechTransactionSchema
>;
export type FintechTransaction = typeof fintechTransactionsTable.$inferSelect;