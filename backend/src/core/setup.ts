// This is a small setup script that runs on first launch on new versions

import { prisma } from '../core/plugins/prisma'
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
    data: [
      { name: "posts.view" },
      { name: "posts.create" },
      { name: "posts.create.dupes" },
      { name: "posts.edit.own" },
      { name: "posts.edit.others" },
      { name: "posts.autotag" },
      { name: "posts.delete.own" },
      { name: "posts.delete.others" },
      { name: "posts.feature" },
      { name: "posts.vote" },
      { name: "posts.favorite" },
      { name: "comment.create" },
      { name: "comment.embed.url" },
      { name: "comment.embed.post" },
      { name: "comment.edit.own" },
      { name: "comment.edit.others" },
      { name: "comment.delete.own" },
      { name: "comment.delete.others" },
      { name: "comment.vote" },
      { name: "pool.create" },
      { name: "pool.manage" },
      { name: "pool.delete" },
      { name: "pool.vote" },
      { name: "profile.create" },
      { name: "profile.view" },
      { name: "profile.edit.avatar" },
      { name: "profile.edit.background" },
      { name: "profile.edit.others" },
      { name: "profile.edit.roles" },
      { name: "profile.archive.others" }, // Delete user but not posts
      { name: "profile.delete.others" },  // Delete user and posts
      { name: "upload.type.image" },
      { name: "upload.type.animated" },
      { name: "upload.type.video" },
      { name: "limit.upload.ignore" },
      { name: "tags.create" },
      { name: "tags.edit" },
      { name: "tags.delete" },
      { name: "tags.categories.manage" },
      { name: "dashboard.view" },
      { name: "dashboard.analytics" },
      { name: "dashboard.update" },
      { name: "dashboard.backups" },
      { name: "dashboard.roles" },
      { name: "dashboard.audit.log" },
      { name: "dashboard.addons" },
      { name: "dashboard.checks" },
      { name: "administrator" },
    ],
    skipDuplicates: true,
  })
}