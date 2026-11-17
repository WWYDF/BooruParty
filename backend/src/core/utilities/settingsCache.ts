import { Prisma } from "../../../prisma/client";
import { appLogger } from "../plugins/logger";
import { prisma } from "../plugins/prisma";

const logger = appLogger('Settings');

// Allowlist
// Only these columns are cached (lastSetupVersion is internet to setup for example)
// A new setting has to be added here before the rest of the app can see it
const settingsSelect = {
  guestAccess: true,
  guestSafety: true,
  featuredPostId: true,
} satisfies Prisma.ServerSettingsSelect;

export type CachedSettings = Prisma.ServerSettingsGetPayload<{ select: typeof settingsSelect }>;

let settings: CachedSettings | null = null;

// Reads the settings row into memory.
// Calls once at startup (after setup), and again whenever settings are edited.
export async function loadServerSettings() {
  const row = await prisma.serverSettings.findUnique({ where: { id: 1 }, select: settingsSelect });
  if (!row) throw new Error('ServerSettings row is missing. Did checkSetup() run first?');

  settings = row;
  logger.info('[+] Refreshed server settings.');
}

// Synchronous read for hot paths like getViewer
export function getServerSettings(): Readonly<CachedSettings> {
  if (!settings) throw new Error('Server Settings read before loadServerSettings() ran');
  return settings;
}