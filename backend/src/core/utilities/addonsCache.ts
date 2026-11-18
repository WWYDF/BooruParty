import { Addons } from "../../../prisma/client";
import { appLogger } from "../plugins/logger";
import { prisma } from "../plugins/prisma";

const logger = appLogger('Addons');

let addons: Addons | null = null;

// Reads the addons row into memory.
// Calls once at startup (after setup), and again whenever addons are edited.
export async function loadServerAddons() {
  const row = await prisma.addons.findUnique({ where: { id: 1 } });
  if (!row) throw new Error('Addons row is missing. Did checkSetup() run first?');

  addons = row;
  logger.info('[+] Refreshed server addons.');
}

// Synchronous read for hot paths
export function getServerAddons(): Readonly<Addons> {
  if (!addons) throw new Error('Server Addons read before loadServerAddons() ran');
  return addons;
}