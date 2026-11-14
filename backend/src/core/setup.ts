// This is a small setup script that runs on first launch on new versions

import { prisma } from '../core/plugins/prisma'
import { PermissionName, PERMISSIONS } from './objects/permissions';
import { appLogger } from './plugins/logger';
import { CURRENT_VERSION } from './version';

const logger = appLogger('Setup');

export async function checkSetup() {
  await syncPermissions();
  const settings = await prisma.serverSettings.findUnique({ where: { id: 1 } });
  if (!settings) { await runSetup() }
  else if (settings.lastSetupVersion == '0.14.2') {  }
  // add new lines for new versions i guess

  else { logger.success('[+] App passed setup checks!') };
}

async function runSetup() {
  logger.warn('[!] Running through setup.. Please do not cancel this process.');

  // Create default roles
  for (const { perms, ...role } of default_roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: {
        ...role,
        permissions: { connect: perms.map((name) => ({ name })) },
      },
    });
  }

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


const default_perms: PermissionName[] = [
  "posts.view",
  "posts.create",
  "posts.edit.own",
  "posts.delete.own",
  "posts.vote",
  "posts.favorite",
  "comment.create",
  "comment.embed.post",
  "comment.edit.own",
  "comment.delete.own",
  "comment.vote",
  "pool.vote",
  "profile.create",
  "profile.view",
  "profile.edit.avatar",
  "upload.type.image",
  "upload.type.animated",
]

const vip_perms: PermissionName[] = [
  ...default_perms,
  "posts.create.dupes",
  "posts.edit.others",
  "posts.autotag",
  "comment.embed.url",
  "upload.type.video",
  "tags.create",
  "tags.edit",
  "profile.edit.background"
];

const mod_perms: PermissionName[] = [
  ...vip_perms,
  "posts.delete.others",
  "posts.feature",
  "comment.edit.others",
  "comment.delete.others",
  "pool.create",
  "pool.manage",
  "pool.delete",
  "profile.archive.others",
  "limit.upload.ignore",
  "tags.delete",
  "dashboard.view",
  "dashboard.analytics",
  "dashboard.audit.log"
];

const default_roles = [
  { name: 'Default',   index: 4, color: '#ffffff', isDefault: true, perms: default_perms },
  { name: 'BOT',       index: 3, color: '#f1cb07', perms: [...default_perms, 'posts.autotag'] as PermissionName[] },
  { name: 'VIP',       index: 2, color: '#07f2ee', perms: vip_perms },
  { name: 'Moderator', index: 1, color: '#6d9ffd', perms: mod_perms },
  { name: 'Admin',     index: 0, color: '#fa5043', perms: ['administrator'] as PermissionName[] },
];