import { createInsertSchema } from "drizzle-zod";
import { boolean, pgTable, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { fintechProfilesTable } from "./fintech-profiles";

export const fintechSettingsTable = pgTable("fintech_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => fintechProfilesTable.id, { onDelete: "cascade" }),
  showUsername: boolean("show_username").notNull().default(true),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  theme: text("theme").$type<"light" | "dark">().notNull().default("light"),
});

export const insertFintechSettingsSchema =
  createInsertSchema(fintechSettingsTable);
export type InsertFintechSettings = z.infer<
  typeof insertFintechSettingsSchema
>;
export type FintechSettings = typeof fintechSettingsTable.$inferSelect;