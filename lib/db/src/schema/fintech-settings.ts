import { createInsertSchema } from "drizzle-zod";
import { boolean, check, integer, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { fintechProfilesTable } from "./fintech-profiles";

export const fintechSettingsTable = pgTable(
  "fintech_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => fintechProfilesTable.id, { onDelete: "cascade" }),
    showUsername: boolean("show_username").notNull().default(true),
    phoneSearchEnabled: boolean("phone_search_enabled").notNull().default(false),
    notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
    sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(15),
    lockOnReturn: boolean("lock_on_return").notNull().default(true),
    theme: text("theme").$type<"light" | "dark">().notNull().default("light"),
  },
  (table) => [
    check(
      "fintech_settings_session_timeout",
      sql`${table.sessionTimeoutMinutes} IN (5, 15, 30, 60)`,
    ),
  ],
);

export const insertFintechSettingsSchema =
  createInsertSchema(fintechSettingsTable);
export type InsertFintechSettings = z.infer<
  typeof insertFintechSettingsSchema
>;
export type FintechSettings = typeof fintechSettingsTable.$inferSelect;