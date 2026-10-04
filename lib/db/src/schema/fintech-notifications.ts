import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { fintechProfilesTable } from "./fintech-profiles";

export const fintechNotificationsTable = pgTable("fintech_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => fintechProfilesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export const insertFintechNotificationSchema = createInsertSchema(
  fintechNotificationsTable,
).omit({ id: true, createdAt: true, readAt: true });
export type InsertFintechNotification = z.infer<
  typeof insertFintechNotificationSchema
>;
export type FintechNotification = typeof fintechNotificationsTable.$inferSelect;