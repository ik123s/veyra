import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ChangePinBody,
  CreateMyAccountBody,
  CreateMyAccountResponse,
  GetMyAccountResponse,
  SearchAccountQueryParams,
  SearchAccountResponse,
  UpdateMyAccountBody,
  UpdateMyAccountResponse,
} from "@workspace/api-zod";
import {
  db,
  fintechNotificationsTable,
  fintechProfilesTable,
  fintechSecurityTable,
  fintechSettingsTable,
  fintechTransactionsTable,
  fintechWalletsTable,
} from "@workspace/db";
import { getUserProfile } from "../lib/fintech-data";
import {
  generateAccountNumber,
  generateTransactionReference,
  hashPin,
  verifyPin,
} from "../lib/fintech-security";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
const STARTING_BALANCE = 50_000;

router.use(requireAuth);

router.get("/accounts/me", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const profile = await getUserProfile(userId);
  if (!profile) {
    res.status(404).json({ error: "Complete your in-app profile to continue." });
    return;
  }
  res.json(GetMyAccountResponse.parse(profile));
});

router.post("/accounts", async (req, res): Promise<void> => {
  const parsed = CreateMyAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const username = parsed.data.username.toLowerCase();
  if (await getUserProfile(userId)) {
    res.status(409).json({ error: "An in-app account already exists." });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      const [existingUsername] = await tx
        .select({ id: fintechProfilesTable.id })
        .from(fintechProfilesTable)
        .where(eq(fintechProfilesTable.username, username))
        .limit(1);
      if (existingUsername) {
        throw new Error("USERNAME_TAKEN");
      }

      let accountNumber = generateAccountNumber();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const [existingAccount] = await tx
          .select({ id: fintechProfilesTable.id })
          .from(fintechProfilesTable)
          .where(eq(fintechProfilesTable.accountNumber, accountNumber))
          .limit(1);
        if (!existingAccount) break;
        accountNumber = generateAccountNumber();
      }

      await tx.insert(fintechProfilesTable).values({
        id: userId,
        originalName: parsed.data.originalName.trim(),
        username,
        accountNumber,
      });
      await tx.insert(fintechSettingsTable).values({ userId });
      await tx.insert(fintechSecurityTable).values({
        userId,
        pinHash: hashPin(parsed.data.pin),
      });
      await tx.insert(fintechWalletsTable).values({
        userId,
        balance: STARTING_BALANCE,
      });
      await tx.insert(fintechTransactionsTable).values({
        transactionId: generateTransactionReference(),
        senderUserId: null,
        recipientUserId: userId,
        amount: STARTING_BALANCE,
        transactionType: "welcome_credit",
        status: "completed",
        title: "Starting demo balance",
      });
      await tx.insert(fintechNotificationsTable).values({
        userId,
        type: "account_ready",
        title: "Your demo wallet is ready",
        message:
          "₦50,000 Virtual Balance / Demo Money has been added. It has no real monetary value.",
      });
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const message = error instanceof Error ? error.message : "";
    if (message === "USERNAME_TAKEN" || code === "23505") {
      res.status(409).json({ error: "That username is already in use." });
      return;
    }
    throw error;
  }

  const profile = await getUserProfile(userId);
  if (!profile) {
    throw new Error("Created profile could not be loaded.");
  }
  res.status(201).json(CreateMyAccountResponse.parse(profile));
});

router.patch("/accounts/me", async (req, res): Promise<void> => {
  const parsed = UpdateMyAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  const existing = await getUserProfile(userId);
  if (!existing) {
    res.status(404).json({ error: "In-app account not found." });
    return;
  }

  const values = parsed.data;
  const profileValues: Partial<typeof fintechProfilesTable.$inferInsert> = {};
  if (values.originalName !== undefined) {
    profileValues.originalName = values.originalName.trim();
  }
  if (values.username !== undefined) {
    profileValues.username = values.username.toLowerCase();
  }
  try {
    await db.transaction(async (tx) => {
      if (Object.keys(profileValues).length > 0) {
        await tx
          .update(fintechProfilesTable)
          .set(profileValues)
          .where(eq(fintechProfilesTable.id, userId));
      }

      const settingsValues: Partial<typeof fintechSettingsTable.$inferInsert> =
        {};
      if (values.showUsername !== undefined) {
        settingsValues.showUsername = values.showUsername;
      }
      if (values.notificationsEnabled !== undefined) {
        settingsValues.notificationsEnabled = values.notificationsEnabled;
      }
      if (values.theme !== undefined) settingsValues.theme = values.theme;
      if (Object.keys(settingsValues).length > 0) {
        await tx
          .update(fintechSettingsTable)
          .set(settingsValues)
          .where(eq(fintechSettingsTable.userId, userId));
      }
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "23505") {
      res.status(409).json({ error: "That username is already in use." });
      return;
    }
    throw error;
  }

  const updated = await getUserProfile(userId);
  if (!updated) {
    res.status(404).json({ error: "In-app account not found." });
    return;
  }
  res.json(UpdateMyAccountResponse.parse(updated));
});

router.get("/accounts/search", async (req, res): Promise<void> => {
  const parsed = SearchAccountQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  const query = parsed.data.query.trim().replace(/^@/, "").toLowerCase();
  const accountNumberQuery = /^\d{10}$/.test(query);
  const [match] = await db
    .select({
      id: fintechProfilesTable.id,
      originalName: fintechProfilesTable.originalName,
      username: fintechProfilesTable.username,
      accountNumber: fintechProfilesTable.accountNumber,
    })
    .from(fintechProfilesTable)
    .where(
      accountNumberQuery
        ? eq(fintechProfilesTable.accountNumber, query)
        : eq(fintechProfilesTable.username, query),
    )
    .limit(1);

  if (!match || match.id === userId) {
    res.status(404).json({ error: "No other account matched that search." });
    return;
  }
  res.json(
    SearchAccountResponse.parse({
      originalName: match.originalName,
      username: match.username,
      accountNumber: match.accountNumber,
    }),
  );
});

router.patch("/security/pin", async (req, res): Promise<void> => {
  const parsed = ChangePinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  const result = await db.transaction(async (tx) => {
    const [security] = await tx
      .select()
      .from(fintechSecurityTable)
      .where(eq(fintechSecurityTable.userId, userId))
      .for("update")
      .limit(1);
    if (!security) return { error: "Security PIN not found.", status: 404 };
    if (security.pinLockedUntil && security.pinLockedUntil > new Date()) {
      return {
        error: "PIN updates are temporarily locked. Try again later.",
        status: 400,
      };
    }
    if (!verifyPin(parsed.data.currentPin, security.pinHash)) {
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
        .where(eq(fintechSecurityTable.userId, userId));
      return { error: "The current PIN is incorrect.", status: 400 };
    }
    await tx
      .update(fintechSecurityTable)
      .set({
        pinHash: hashPin(parsed.data.newPin),
        failedPinAttempts: 0,
        pinLockedUntil: null,
      })
      .where(eq(fintechSecurityTable.userId, userId));
    return { success: true as const };
  });
  if ("error" in result) {
    res.status(result.status ?? 500).json({ error: result.error });
    return;
  }
  res.sendStatus(204);
});

export default router;