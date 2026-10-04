import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const fintechProfilesTable = pgTable("fintech_profiles", {
  id: text("id").primaryKey(),
  originalName: text("original_name").notNull(),
  username: text("username").notNull().unique(),
  accountNumber: text("account_number").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertFintechProfileSchema = createInsertSchema(
  fintechProfilesTable,
).omit({ createdAt: true });
export type InsertFintechProfile = z.infer<typeof insertFintechProfileSchema>;
export type FintechProfile = typeof fintechProfilesTable.$inferSelect;