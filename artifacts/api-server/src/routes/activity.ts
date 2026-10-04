import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetTransactionParams,
  GetTransactionResponse,
  ListNotificationsResponse,
  ListTransactionsResponse,
  UpdateNotificationBody,
  UpdateNotificationParams,
  UpdateNotificationResponse,
} from "@workspace/api-zod";
import {
  db,
  fintechNotificationsTable,
} from "@workspace/db";
import {
  findTransactionForUser,
  listNotificationsForUser,
  listTransactionsForUser,
  transactionResponse,
} from "../lib/fintech-data";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/transactions", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const rows = await listTransactionsForUser(userId);
  const result = rows.map((row) => transactionResponse(row, userId));
  res.json(ListTransactionsResponse.parse(result));
});

router.get("/transactions/:transactionId", async (req, res): Promise<void> => {
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  const row = await findTransactionForUser(params.data.transactionId, userId);
  if (!row) {
    res.status(404).json({ error: "Transaction not found." });
    return;
  }
  res.json(
    GetTransactionResponse.parse(transactionResponse(row, userId)),
  );
});

router.get("/notifications", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const notifications = await listNotificationsForUser(userId);
  res.json(ListNotificationsResponse.parse(notifications));
});

router.patch(
  "/notifications/:notificationId",
  async (req, res): Promise<void> => {
    const params = UpdateNotificationParams.safeParse(req.params);
    const body = UpdateNotificationBody.safeParse(req.body);
    if (!params.success || !body.success) {
      const error = params.success
        ? body.success
          ? "Invalid notification update."
          : body.error.message
        : params.error.message;
      res.status(400).json({ error });
      return;
    }
    const userId = res.locals.userId as string;
    const [updated] = await db
      .update(fintechNotificationsTable)
      .set({
        isRead: body.data.isRead,
        readAt: body.data.isRead ? new Date() : null,
      })
      .where(
        and(
          eq(fintechNotificationsTable.id, params.data.notificationId),
          eq(fintechNotificationsTable.userId, userId),
        ),
      )
      .returning({
        id: fintechNotificationsTable.id,
        type: fintechNotificationsTable.type,
        title: fintechNotificationsTable.title,
        message: fintechNotificationsTable.message,
        isRead: fintechNotificationsTable.isRead,
        createdAt: fintechNotificationsTable.createdAt,
      });

    if (!updated) {
      res.status(404).json({ error: "Notification not found." });
      return;
    }
    res.json(
      UpdateNotificationResponse.parse({
        ...updated,
        createdAt: updated.createdAt.toISOString(),
      }),
    );
  },
);

export default router;