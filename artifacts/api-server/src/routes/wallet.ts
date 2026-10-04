import { and, count, eq, gte, or, sum } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { GetWalletStatsResponse } from "@workspace/api-zod";
import {
  db,
  fintechTransactionsTable,
  fintechWalletsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/wallet/stats", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const [wallet] = await db
    .select({ virtualBalance: fintechWalletsTable.balance })
    .from(fintechWalletsTable)
    .where(eq(fintechWalletsTable.userId, userId))
    .limit(1);
  if (!wallet) {
    res.status(404).json({ error: "Virtual wallet not found." });
    return;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const transferFilter = eq(fintechTransactionsTable.transactionType, "internal_transfer");
  const completedFilter = eq(fintechTransactionsTable.status, "completed");
  const [sent] = await db
    .select({ total: sum(fintechTransactionsTable.amount) })
    .from(fintechTransactionsTable)
    .where(
      and(
        eq(fintechTransactionsTable.senderUserId, userId),
        transferFilter,
        completedFilter,
      ),
    );
  const [received] = await db
    .select({ total: sum(fintechTransactionsTable.amount) })
    .from(fintechTransactionsTable)
    .where(
      and(
        eq(fintechTransactionsTable.recipientUserId, userId),
        transferFilter,
        completedFilter,
      ),
    );
  const [monthlySent] = await db
    .select({ total: sum(fintechTransactionsTable.amount) })
    .from(fintechTransactionsTable)
    .where(
      and(
        eq(fintechTransactionsTable.senderUserId, userId),
        transferFilter,
        completedFilter,
        gte(fintechTransactionsTable.createdAt, monthStart),
      ),
    );
  const [monthlyReceived] = await db
    .select({ total: sum(fintechTransactionsTable.amount) })
    .from(fintechTransactionsTable)
    .where(
      and(
        eq(fintechTransactionsTable.recipientUserId, userId),
        transferFilter,
        completedFilter,
        gte(fintechTransactionsTable.createdAt, monthStart),
      ),
    );
  const [activity] = await db
    .select({ total: count() })
    .from(fintechTransactionsTable)
    .where(
      or(
        eq(fintechTransactionsTable.senderUserId, userId),
        eq(fintechTransactionsTable.recipientUserId, userId),
      ),
    );

  res.json(
    GetWalletStatsResponse.parse({
      virtualBalance: wallet.virtualBalance,
      totalSent: Number(sent?.total ?? 0),
      totalReceived: Number(received?.total ?? 0),
      transactionCount: activity?.total ?? 0,
      monthlySent: Number(monthlySent?.total ?? 0),
      monthlyReceived: Number(monthlyReceived?.total ?? 0),
    }),
  );
});

export default router;