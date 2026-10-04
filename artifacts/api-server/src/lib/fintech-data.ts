import { and, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  db,
  fintechNotificationsTable,
  fintechProfilesTable,
  fintechSecurityTable,
  fintechSettingsTable,
  fintechTransactionsTable,
  fintechWalletsTable,
} from "@workspace/db";
import { isAdminUser } from "./admin-access";

const senderProfile = alias(fintechProfilesTable, "sender_profile");
const recipientProfile = alias(fintechProfilesTable, "recipient_profile");

export async function getUserProfile(userId: string) {
  const [row] = await db
    .select({
      id: fintechProfilesTable.id,
      originalName: fintechProfilesTable.originalName,
      firstName: fintechProfilesTable.firstName,
      lastName: fintechProfilesTable.lastName,
      username: fintechProfilesTable.username,
      accountNumber: fintechProfilesTable.accountNumber,
      phone: fintechProfilesTable.phone,
      dateOfBirth: fintechProfilesTable.dateOfBirth,
      createdAt: fintechProfilesTable.createdAt,
      virtualBalance: fintechWalletsTable.balance,
      showUsername: fintechSettingsTable.showUsername,
      phoneSearchEnabled: fintechSettingsTable.phoneSearchEnabled,
      notificationsEnabled: fintechSettingsTable.notificationsEnabled,
      sessionTimeoutMinutes: fintechSettingsTable.sessionTimeoutMinutes,
      lockOnReturn: fintechSettingsTable.lockOnReturn,
      theme: fintechSettingsTable.theme,
      pinSet: fintechSecurityTable.userId,
    })
    .from(fintechProfilesTable)
    .innerJoin(
      fintechWalletsTable,
      eq(fintechWalletsTable.userId, fintechProfilesTable.id),
    )
    .innerJoin(
      fintechSettingsTable,
      eq(fintechSettingsTable.userId, fintechProfilesTable.id),
    )
    .leftJoin(
      fintechSecurityTable,
      eq(fintechSecurityTable.userId, fintechProfilesTable.id),
    )
    .where(eq(fintechProfilesTable.id, userId));

  if (!row) return null;
  const nameParts = row.originalName.trim().split(/\s+/);
  return {
    ...row,
    firstName: row.firstName ?? nameParts[0] ?? "",
    lastName: row.lastName ?? nameParts.slice(1).join(" "),
    isAdmin: isAdminUser(userId),
    dateOfBirth: row.dateOfBirth ?? null,
    phone: row.phone ?? null,
    createdAt: row.createdAt.toISOString(),
    pinSet: row.pinSet !== null,
  };
}

export async function findTransactionForUser(
  transactionId: string,
  userId: string,
) {
  const [row] = await db
    .select({
      id: fintechTransactionsTable.id,
      transactionId: fintechTransactionsTable.transactionId,
      senderUserId: fintechTransactionsTable.senderUserId,
      recipientUserId: fintechTransactionsTable.recipientUserId,
      senderUsername: senderProfile.username,
      senderName: senderProfile.originalName,
      recipientUsername: recipientProfile.username,
      recipientName: recipientProfile.originalName,
      amount: fintechTransactionsTable.amount,
      transactionType: fintechTransactionsTable.transactionType,
      status: fintechTransactionsTable.status,
      title: fintechTransactionsTable.title,
      createdAt: fintechTransactionsTable.createdAt,
    })
    .from(fintechTransactionsTable)
    .leftJoin(
      senderProfile,
      eq(fintechTransactionsTable.senderUserId, senderProfile.id),
    )
    .leftJoin(
      recipientProfile,
      eq(fintechTransactionsTable.recipientUserId, recipientProfile.id),
    )
    .where(
      and(
        eq(fintechTransactionsTable.id, transactionId),
        or(
          eq(fintechTransactionsTable.senderUserId, userId),
          eq(fintechTransactionsTable.recipientUserId, userId),
        ),
      ),
    );
  return row ?? null;
}

export async function listTransactionsForUser(userId: string) {
  return db
    .select({
      id: fintechTransactionsTable.id,
      transactionId: fintechTransactionsTable.transactionId,
      senderUserId: fintechTransactionsTable.senderUserId,
      recipientUserId: fintechTransactionsTable.recipientUserId,
      senderUsername: senderProfile.username,
      senderName: senderProfile.originalName,
      recipientUsername: recipientProfile.username,
      recipientName: recipientProfile.originalName,
      amount: fintechTransactionsTable.amount,
      transactionType: fintechTransactionsTable.transactionType,
      status: fintechTransactionsTable.status,
      title: fintechTransactionsTable.title,
      createdAt: fintechTransactionsTable.createdAt,
    })
    .from(fintechTransactionsTable)
    .leftJoin(
      senderProfile,
      eq(fintechTransactionsTable.senderUserId, senderProfile.id),
    )
    .leftJoin(
      recipientProfile,
      eq(fintechTransactionsTable.recipientUserId, recipientProfile.id),
    )
    .where(
      or(
        eq(fintechTransactionsTable.senderUserId, userId),
        eq(fintechTransactionsTable.recipientUserId, userId),
      ),
    )
    .orderBy(desc(fintechTransactionsTable.createdAt))
    .limit(100);
}

export function transactionResponse(
  row: NonNullable<Awaited<ReturnType<typeof findTransactionForUser>>>,
  viewerId: string,
) {
  let direction: "sent" | "received" | "activity" | "welcome" = "activity";
  if (row.transactionType === "welcome_credit") direction = "welcome";
  else if (row.transactionType === "internal_transfer") {
    direction = row.senderUserId === viewerId ? "sent" : "received";
  }

  return {
    id: row.id,
    transactionId: row.transactionId,
    senderUsername: row.senderUsername,
    senderName: row.senderName,
    recipientUsername: row.recipientUsername,
    recipientName: row.recipientName,
    amount: row.amount,
    transactionType: row.transactionType,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    direction,
    title: row.title,
  };
}

export async function listNotificationsForUser(userId: string) {
  const rows = await db
    .select({
      id: fintechNotificationsTable.id,
      type: fintechNotificationsTable.type,
      title: fintechNotificationsTable.title,
      message: fintechNotificationsTable.message,
      isRead: fintechNotificationsTable.isRead,
      createdAt: fintechNotificationsTable.createdAt,
    })
    .from(fintechNotificationsTable)
    .where(eq(fintechNotificationsTable.userId, userId))
    .orderBy(desc(fintechNotificationsTable.createdAt))
    .limit(100);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}