import {
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length !== 16 || expected.length !== 64) return false;
  const actual = scryptSync(pin, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function generateAccountNumber(): string {
  return String(randomInt(1_000_000_000, 10_000_000_000));
}

export function generateTransactionReference(): string {
  return `ND-${randomBytes(7).toString("hex").toUpperCase()}`;
}