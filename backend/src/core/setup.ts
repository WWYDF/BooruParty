// This is a small setup script that runs on first launch on new versions

import { prisma } from '../core/plugins/prisma'
import { PERMISSIONS } from './objects/permissions';
import { appLogger } from './plugins/logger';
import { CURRENT_VERSION } from './version';

const logger = appLogger('Setup');

export async function checkSetup() {
  await syncPermissions();
  const settings = await prisma.serverSettings.findUnique({ where: { id: 1 } });
  if (!settings) { await runSetup() }
  else if (settings.lastSetupVersion == '0.14.2') {  }
  // add new lines for new versions i guess

  else { logger.info('[+] App passed setup checks!') };
}

async function runSetup() {
  logger.warn('[!] Running through setup.. Please do not cancel this process.');

  // Create default roles
  await prisma.role.createMany({
    data: [
      { name: 'Default', index: 4, color: '#ffffff', isDefault: true },
      { name: 'BOT', index: 3, color: '#f1cb07' },
      { name: 'VIP', index: 2, color: '#07f2ee' },
      { name: 'Moderator', index: 1, color: '#6d9ffd' },
      { name: 'Admin', index: 0, color: '#fa5043' },
    ],
    skipDuplicates: true,
  })

  // Assign administrator permission to ADMIN role.
  await prisma.role.update({
    where: { name: 'Admin' },
    data: { permissions: { connect: [{ name: 'administrator' }] } }
  });

  // Finally, log setup in Settings for future checks
  await prisma.serverSettings.upsert({
    where: { id: 1 },
    update: { lastSetupVersion: CURRENT_VERSION },
    create: {
      lastSetupVersion: CURRENT_VERSION,
      // plus any other default overrides
    }
  })

  logger.success(`[+] Finished setting up! Continue on frontend through ${process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/setup` : 'the website.'}`)
}

async function syncPermissions() {
  await prisma.permission.createMany({
    data: PERMISSIONS.map((name) => ({ name })),
    skipDuplicates: true,
  });
}