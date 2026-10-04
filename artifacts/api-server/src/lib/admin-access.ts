const configuredAdminIds = new Set(
  (process.env.NAIRA_DEMO_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

export function isAdminUser(userId: string): boolean {
  return configuredAdminIds.has(userId);
}