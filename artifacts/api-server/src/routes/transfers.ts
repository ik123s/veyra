import { and, eq, inArray, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateTransferBody,
  CreateTransferResponse,
  SimulateServiceBody,
  SimulateServiceResponse,
} from "@workspace/api-zod";
import {
  db,
  fintechNotificationsTable,
  fintechProfilesTable,
  fintechSecurityTable,
  fintechTransactionsTable,
  fintechWalletsTable,
} from "@workspace/db";
import {
  findTransactionForUser,
  getUserProfile,
  transactionResponse,
} from "../lib/fintech-data";
import {
  generateTransactionReference,
  verifyPin,
} from "../lib/fintech-security";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

router.post("/transfers", async (req, res): Promise<void> => {
  const parsed = CreateTransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const senderId = res.locals.userId as string;
  const { clientRequestId, recipientAccountNumber, amount, pin } = parsed.data;
  const result = await db.transaction(async (tx) => {
    const [security] = await tx
      .select()
      .from(fintechSecurityTable)
      .where(eq(fintechSecurityTable.userId, senderId))
      .for("update")
      .limit(1);
    if (!security) {
      return { error: "Complete your in-app account setup before transferring.", status: 404 };
    }

    // Locking the sender's security row serializes requests from this account.
    // Check the idempotency key after taking that lock so parallel retries see
    // the first committed transfer instead of attempting a second debit.
    const [existing] = await tx
      .select({
        id: fintechTransactionsTable.id,
        senderUserId: fintechTransactionsTable.senderUserId,
        recipientUserId: fintechTransactionsTable.recipientUserId,
        amount: fintechTransactionsTable.amount,
      })
      .from(fintechTransactionsTable)
      .where(eq(fintechTransactionsTable.clientRequestId, clientRequestId))
      .limit(1);
    if (existing) {
      if (
        existing.senderUserId === senderId &&
        existing.amount === amount &&
        existing.recipientUserId
      ) {
        const [priorRecipient] = await tx
          .select({ accountNumber: fintechProfilesTable.accountNumber })
          .from(fintechProfilesTable)
          .where(eq(fintechProfilesTable.id, existing.recipientUserId))
          .limit(1);
        if (priorRecipient?.accountNumber === recipientAccountNumber) {
          return { transactionId: existing.id };
        }
      }
      return { error: "This request ID was already used for a different transfer.", status: 409 };
    }

    if (security.pinLockedUntil && security.pinLockedUntil > new Date()) {
      return { error: "PIN verification is temporarily locked. Try again later.", status: 400 };
    }
    if (!verifyPin(pin, security.pinHash)) {
      const failedAttempts = security.failedPinAttempts + 1;
      await tx
        .update(fintechSecurityTable)
        .set({
          failedPinAttempts: failedAttempts,
          pinLockedUntil:
            failedAttempts >= 5
              ? new Date(Date.now() + 15 * 60 * 1000)
              : null,
        })
        .where(eq(fintechSecurityTable.userId, senderId));
      return { error: "The security PIN is incorrect.", status: 400 };
    }

    const [sender] = await tx
      .select({
        id: fintechProfilesTable.id,
        username: fintechProfilesTable.username,
        originalName: fintechProfilesTable.originalName,
      })
      .from(fintechProfilesTable)
      .where(eq(fintechProfilesTable.id, senderId))
      .limit(1);
    const [recipient] = await tx
      .select({
        id: fintechProfilesTable.id,
        username: fintechProfilesTable.username,
        originalName: fintechProfilesTable.originalName,
        accountNumber: fintechProfilesTable.accountNumber,
      })
      .from(fintechProfilesTable)
      .where(eq(fintechProfilesTable.accountNumber, recipientAccountNumber))
      .limit(1);

    if (!sender) {
      return { error: "Complete your in-app account setup before transferring.", status: 404 };
    }
    if (!recipient) {
      return { error: "Recipient account not found.", status: 404 };
    }
    if (recipient.id === senderId) {
      return { error: "You cannot transfer virtual funds to your own account.", status: 400 };
    }

    const walletIds = [senderId, recipient.id].sort();
    const lockedWallets = await tx
      .select({
        userId: fintechWalletsTable.userId,
        balance: fintechWalletsTable.balance,
      })
      .from(fintechWalletsTable)
      .where(inArray(fintechWalletsTable.userId, walletIds))
      .orderBy(fintechWalletsTable.userId)
      .for("update");
    const senderWallet = lockedWallets.find((wallet) => wallet.userId === senderId);
    const recipientWallet = lockedWallets.find(
      (wallet) => wallet.userId === recipient.id,
    );
    if (!senderWallet || !recipientWallet) {
      return { error: "A virtual wallet for this transfer could not be found.", status: 404 };
    }
    if (senderWallet.balance < amount) {
      return { error: "Insufficient Virtual Balance / Demo Money.", status: 409 };
    }

    const [debited] = await tx
      .update(fintechWalletsTable)
      .set({ balance: sql`${fintechWalletsTable.balance} - ${amount}` })
      .where(
        and(
          eq(fintechWalletsTable.userId, senderId),
          sql`${fintechWalletsTable.balance} >= ${amount}`,
        ),
      )
      .returning({ userId: fintechWalletsTable.userId });
    if (!debited) {
      return { error: "Insufficient Virtual Balance / Demo Money.", status: 409 };
    }
    await tx
      .update(fintechWalletsTable)
      .set({ balance: sql`${fintechWalletsTable.balance} + ${amount}` })
      .where(eq(fintechWalletsTable.userId, recipient.id));

    const [created] = await tx
      .insert(fintechTransactionsTable)
      .values({
        transactionId: generateTransactionReference(),
        clientRequestId,
        senderUserId: senderId,
        recipientUserId: recipient.id,
        amount,
        transactionType: "internal_transfer",
        status: "completed",
        title: "Virtual transfer",
      })
      .returning({ id: fintechTransactionsTable.id });

    const senderName = sender.username || sender.originalName;
    const formattedAmount = new Intl.NumberFormat("en-NG").format(amount);
    await tx.insert(fintechNotificationsTable).values({
      userId: recipient.id,
      type: "virtual_transfer_received",
      title: "Virtual money received",
      message: `₦${formattedAmount} Virtual Balance / Demo Money received from ${senderName}.`,
    });
    await tx
      .update(fintechSecurityTable)
      .set({ failedPinAttempts: 0, pinLockedUntil: null })
      .where(eq(fintechSecurityTable.userId, senderId));

    return { transactionId: created.id };
  });

  if ("error" in result) {
    res.status(result.status ?? 500).json({ error: result.error });
    return;
  }
  const row = await findTransactionForUser(result.transactionId, senderId);
  if (!row) {
    throw new Error("Transfer was recorded but could not be loaded.");
  }
  res.status(201).json(
    CreateTransferResponse.parse(transactionResponse(row, senderId)),
  );
});

router.post("/services/simulate", async (req, res): Promise<void> => {
  const parsed = SimulateServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  if (!(await getUserProfile(userId))) {
    res.status(404).json({ error: "Complete your in-app account setup first." });
    return;
  }
  const [created] = await db
    .insert(fintechTransactionsTable)
    .values({
      transactionId: generateTransactionReference(),
      senderUserId: userId,
      recipientUserId: null,
      amount: parsed.data.amount,
      transactionType: `${parsed.data.serviceType}_simulation`,
      status: "simulated",
      title: parsed.data.title.trim(),
    })
    .returning({ id: fintechTransactionsTable.id });

  const row = await findTransactionForUser(created.id, userId);
  if (!row) {
    throw new Error("Simulation was recorded but could not be loaded.");
  }
  res.status(201).json(
    SimulateServiceResponse.parse(transactionResponse(row, userId)),
  );
});

export default router;