import { and, eq, sum, sql } from "drizzle-orm";
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
const STARTING_BALANCE = 500_000_000;

function getPostgresErrorDetails(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const value = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (value.code || value.constraint) {
      return {
        code: value.code ? String(value.code) : "",
        constraint: value.constraint ? String(value.constraint) : "",
      };
    }
    current = value.cause;
  }
  return { code: "", constraint: "" };
}

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
  const firstName = parsed.data.firstName.trim();
  const lastName = parsed.data.lastName.trim();
  const originalName = `${firstName} ${lastName}`;
  const dateOfBirth = parsed.data.dateOfBirth;
  const dateOfBirthValue = dateOfBirth.toISOString().slice(0, 10);
  if (dateOfBirth.getTime() > Date.now()) {
    res.status(400).json({ error: "Enter a valid date of birth." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    let [profile] = await tx
      .select({ id: fintechProfilesTable.id })
      .from(fintechProfilesTable)
      .where(eq(fintechProfilesTable.id, userId))
      .for("update")
      .limit(1);
    let profileCreated = false;

    if (!profile) {
      const [usernameOwner] = await tx
        .select({ id: fintechProfilesTable.id })
        .from(fintechProfilesTable)
        .where(eq(fintechProfilesTable.username, username))
        .limit(1);
      if (usernameOwner && usernameOwner.id !== userId) {
        return { ok: false as const, reason: "username" as const };
      }
      const [phoneOwner] = await tx
        .select({ id: fintechProfilesTable.id })
        .from(fintechProfilesTable)
        .where(eq(fintechProfilesTable.phone, parsed.data.phone))
        .limit(1);
      if (phoneOwner && phoneOwner.id !== userId) {
        return { ok: false as const, reason: "phone" as const };
      }

      for (let attempt = 0; attempt < 10 && !profile; attempt += 1) {
        const [inserted] = await tx
          .insert(fintechProfilesTable)
          .values({
            id: userId,
            originalName,
            firstName,
            lastName,
            username,
            accountNumber: generateAccountNumber(),
            phone: parsed.data.phone,
            dateOfBirth: dateOfBirthValue,
          })
          .onConflictDoNothing()
          .returning({ id: fintechProfilesTable.id });

        if (inserted) {
          profile = inserted;
          profileCreated = true;
          break;
        }

        [profile] = await tx
          .select({ id: fintechProfilesTable.id })
          .from(fintechProfilesTable)
          .where(eq(fintechProfilesTable.id, userId))
          .for("update")
          .limit(1);
        if (profile) break;

        const [usernameConflict] = await tx
          .select({ id: fintechProfilesTable.id })
          .from(fintechProfilesTable)
          .where(eq(fintechProfilesTable.username, username))
          .limit(1);
        if (usernameConflict) {
          return { ok: false as const, reason: "username" as const };
        }
        const [phoneConflict] = await tx
          .select({ id: fintechProfilesTable.id })
          .from(fintechProfilesTable)
          .where(eq(fintechProfilesTable.phone, parsed.data.phone))
          .limit(1);
        if (phoneConflict) {
          return { ok: false as const, reason: "phone" as const };
        }
      }
      if (!profile) {
        return { ok: false as const, reason: "account_number" as const };
      }
    }

    await tx
      .insert(fintechSettingsTable)
      .values({ userId })
      .onConflictDoNothing();
    await tx
      .insert(fintechSecurityTable)
      .values({ userId, pinHash: hashPin(parsed.data.pin) })
      .onConflictDoNothing();

    const [walletCreated] = await tx
      .insert(fintechWalletsTable)
      .values({ userId, balance: STARTING_BALANCE })
      .onConflictDoNothing()
      .returning({ userId: fintechWalletsTable.userId });

    if (walletCreated) {
      const [priorWelcomeCredit] = await tx
        .select({ id: fintechTransactionsTable.id })
        .from(fintechTransactionsTable)
        .where(
          and(
            eq(fintechTransactionsTable.recipientUserId, userId),
            eq(fintechTransactionsTable.transactionType, "welcome_credit"),
          ),
        )
        .limit(1);

      if (!priorWelcomeCredit) {
        await tx
          .insert(fintechTransactionsTable)
          .values({
            transactionId: generateTransactionReference(),
            senderUserId: null,
            recipientUserId: userId,
            amount: STARTING_BALANCE,
            transactionType: "welcome_credit",
            status: "completed",
            title: "Starting virtual balance",
          });
        await tx.insert(fintechNotificationsTable).values({
          userId,
          type: "account_ready",
          title: "Your demo wallet is ready",
          message:
            "₦500,000,000 Virtual Balance / Demo Money has been added. It has no real monetary value.",
        });
      } else {
        const [totals] = await tx
          .select({
            incoming: sum(
              sql`CASE WHEN ${fintechTransactionsTable.recipientUserId} = ${userId} THEN ${fintechTransactionsTable.amount} ELSE 0 END`,
            ),
            outgoing: sum(
              sql`CASE WHEN ${fintechTransactionsTable.senderUserId} = ${userId} THEN ${fintechTransactionsTable.amount} ELSE 0 END`,
            ),
          })
          .from(fintechTransactionsTable)
          .where(eq(fintechTransactionsTable.status, "completed"));
        const recoveredBalance =
          Number(totals?.incoming ?? 0) - Number(totals?.outgoing ?? 0);
        await tx
          .update(fintechWalletsTable)
          .set({ balance: Math.max(0, recoveredBalance) })
          .where(eq(fintechWalletsTable.userId, userId));
      }
    }

    return { ok: true as const, created: profileCreated || Boolean(walletCreated) };
  });

  if (!result.ok) {
    const message =
      result.reason === "username"
        ? "That username is already in use."
        : result.reason === "phone"
          ? "That phone number is already linked to another account."
          : "We could not allocate a unique account number. Please try again.";
    res.status(409).json({ error: message });
    return;
  }

  const profile = await getUserProfile(userId);
  if (!profile) {
    throw new Error("Created profile could not be loaded.");
  }
  res
    .status(result.created ? 201 : 200)
    .json(CreateMyAccountResponse.parse(profile));
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
    if (values.firstName === undefined && values.lastName === undefined) {
      const [firstName = "", ...lastNameParts] = values.originalName
        .trim()
        .split(/\s+/);
      profileValues.firstName = firstName;
      profileValues.lastName = lastNameParts.join(" ");
    }
  }
  if (values.username !== undefined) {
    profileValues.username = values.username.toLowerCase();
  }
  if (values.firstName !== undefined || values.lastName !== undefined) {
    const firstName = values.firstName ?? existing.firstName;
    const lastName = values.lastName ?? existing.lastName;
    profileValues.firstName = firstName;
    profileValues.lastName = lastName;
    profileValues.originalName = `${firstName} ${lastName}`.trim();
  }
  if (values.phone !== undefined) profileValues.phone = values.phone;
  if (values.dateOfBirth !== undefined) {
    if (values.dateOfBirth && values.dateOfBirth.getTime() > Date.now()) {
      res.status(400).json({ error: "Enter a valid date of birth." });
      return;
    }
    profileValues.dateOfBirth =
      values.dateOfBirth?.toISOString().slice(0, 10) ?? null;
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
      if (values.phoneSearchEnabled !== undefined) {
        settingsValues.phoneSearchEnabled = values.phoneSearchEnabled;
      }
      if (values.notificationsEnabled !== undefined) {
        settingsValues.notificationsEnabled = values.notificationsEnabled;
      }
      if (values.sessionTimeoutMinutes !== undefined) {
        settingsValues.sessionTimeoutMinutes = values.sessionTimeoutMinutes;
      }
      if (values.lockOnReturn !== undefined) {
        settingsValues.lockOnReturn = values.lockOnReturn;
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
    const { code, constraint } = getPostgresErrorDetails(error);
    if (code === "23505") {
      res.status(409).json({
        error: constraint.includes("phone")
          ? "That phone number is already linked to another account."
          : constraint.includes("username")
            ? "That username is already in use."
            : "One of those profile details is already in use.",
      });
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
  const phoneQuery = /^\+234[789][0-9]{9}$/.test(query);
  const [match] = await db
    .select({
      id: fintechProfilesTable.id,
      originalName: fintechProfilesTable.originalName,
      username: fintechProfilesTable.username,
      accountNumber: fintechProfilesTable.accountNumber,
      showUsername: fintechSettingsTable.showUsername,
    })
    .from(fintechProfilesTable)
    .innerJoin(
      fintechSettingsTable,
      eq(fintechSettingsTable.userId, fintechProfilesTable.id),
    )
    .where(
      accountNumberQuery
        ? eq(fintechProfilesTable.accountNumber, query)
        : phoneQuery
          ? and(
              eq(fintechProfilesTable.phone, query),
              eq(fintechSettingsTable.phoneSearchEnabled, true),
            )
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
      username: match.showUsername ? match.username : null,
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