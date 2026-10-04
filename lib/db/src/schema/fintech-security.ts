import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { fintechProfilesTable } from "./fintech-profiles";

export const fintechSecurityTable = pgTable("fintech_security", {
  userId: text("user_id")
    .primaryKey()
    .references(() => fintechProfilesTable.id, { onDelete: "cascade" }),
  pinHash: text("pin_hash").notNull(),
  failedPinAttempts: integer("failed_pin_attempts").notNull().default(0),
  pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
});

export const insertFintechSecuritySchema = createInsertSchema(
  fintechSecurityTable,
);
export type InsertFintechSecurity = z.infer<
  typeof insertFintechSecuritySchema
>;
export type FintechSecurity = typeof fintechSecurityTable.$inferSelect;