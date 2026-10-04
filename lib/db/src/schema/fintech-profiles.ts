import { createInsertSchema } from "drizzle-zod";
import { date, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const fintechProfilesTable = pgTable("fintech_profiles", {
  id: text("id").primaryKey(),
  originalName: text("original_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username").notNull().unique(),
  accountNumber: text("account_number").notNull().unique(),
  phone: text("phone").unique(),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertFintechProfileSchema = createInsertSchema(
  fintechProfilesTable,
).omit({ createdAt: true });
export type InsertFintechProfile = z.infer<typeof insertFintechProfileSchema>;
export type FintechProfile = typeof fintechProfilesTable.$inferSelect;