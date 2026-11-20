// This is a small setup script that runs on first launch on new versions

import { confirm, input, select } from '@inquirer/prompts';
import { prisma } from '../core/plugins/prisma'
import { PermissionName, PERMISSIONS } from './objects/permissions';
import { appLogger } from './plugins/logger';
import { CURRENT_VERSION } from './version';

const logger = appLogger('Setup');

export async function checkSetup() {
  await syncPermissions();
  const settings = await prisma.serverSettings.findUnique({ where: { id: 1 } });
  if (!settings) { await runFirstTimeSetup() }
  else if (settings.lastSetupVersion == '0.14.2') { await runPostImportSetup(); }
  // add new lines for new versions i guess

  else { logger.success('[+] App passed setup checks!') };
}

async function runFirstTimeSetup() {
  logger.warn('[!] Running through first time setup.. Please do not cancel this process.');

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


  // Create default tag category
  await prisma.tagCategory.upsert({
    where: { name: 'Generic' },
    update: {},
    create: { name: 'Generic', color: '#3c9aff', index: 0, isDefault: true }
  });


  // Finally, log setup in Settings for future checks
  await prisma.serverSettings.upsert({
    where: { id: 1 },
    update: { lastSetupVersion: CURRENT_VERSION },
    create: {
      lastSetupVersion: CURRENT_VERSION,
      // plus any other default overrides
    }
  });

  await prisma.addons.upsert({
    where: { id: 1 },
    update: {},
    create: {},
  });

  logger.success(`[+] Finished setting up! Continue on frontend through ${process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/setup` : 'the website.'}`)
}

export async function syncPermissions() {
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
  "posts.boost",
  "comment.create",
  "comment.embed.post",
  "comment.edit.own",
  "comment.delete.own",
  "comment.vote",
  "pool.favorite",
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

export const default_roles = [
  { name: 'Default',   index: 4, color: '#ffffff', isDefault: true, perms: default_perms },
  { name: 'BOT',       index: 3, color: '#f1cb07', perms: [...default_perms, 'posts.autotag'] as PermissionName[] },
  { name: 'VIP',       index: 2, color: '#07f2ee', perms: vip_perms },
  { name: 'Moderator', index: 1, color: '#6d9ffd', perms: mod_perms },
  { name: 'Admin',     index: 0, color: '#fa5043', perms: ['administrator'] as PermissionName[] },
];

async function runPostImportSetup() {
  logger.warn('[!] Running through post-import setup.. Please do not cancel this process.');
  console.log('');

  // First, sync permissions
  await syncPermissions();

  // Next, make sure there is a default role setup
  const roles = await prisma.role.findMany({ orderBy: { index: 'asc' } });

  const defaultRoles = roles.filter((r) => r.isDefault);
  if (defaultRoles.length !== 1) {
    const selDefRole = await select({
      message: `Select which role is the default member role.`,
      choices: [
        ...roles.map((r) => ({ value: r.id, name: r.name })),
        { value: 'create', name: "None. Create a new default role for me" },
      ],
    });
    if (selDefRole === 'create') {
      await prisma.role.upsert({
        where: { name: default_roles[0].name },
        update: {},
        create: default_roles[0],
      });
    } else {
      await prisma.$transaction(async (tx) => {
        tx.role.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
        tx.role.update({
          where: { id: selDefRole },
          data: { isDefault: true }
        });
      });
    }
  };

  // Then, make sure there is an admin role.
  // There's no permissions after an import, so someone needs to be able to access the dashboard lol
  const selAdminRole = await select({
    message: `Select which role is the ADMINISTRATOR role.`,
    choices: [
      ...roles.map((r) => ({ value: r.id, name: r.name })),
      { value: 'create', name: "None. Create a new ADMIN role for me" },
    ],
  });
  if (selAdminRole === 'create') {
    logger.debug(`Creating role 'Admin'...`);
    const admin = default_roles[4];
    const newRole = await prisma.role.upsert({
      where: { name: admin.name },
      update: { permissions: { connect: [{ name: 'administrator' }] } },
      create: {
        name: admin.name,
        index: admin.index,
        color: admin.color,
        isDefault: false,
        permissions: { connect: [{ name: 'administrator' }] }
      },
    });

    const email = await getTargetAdminUser();
    logger.debug(`Assigning new admin role to ${email}...`);
    await prisma.user.update({
      where: { email },
      data: { roleId: newRole.id },
    });

  } else {
    logger.debug(`Adding permission 'administrator' to ${selAdminRole}...`);
    await prisma.role.update({
      where: { id: selAdminRole },
      data: { permissions: { connect: [{ name: 'administrator' }] } },
    });
  };

  // toss result, basically just wanted to pause so they see this lol
  logger.warn(`The permissions system changed between updates, so you need to login with an admin account and set them in the dashboard.`);
  const _understand = await confirm({
    message: 'I understand',
    default: true
  });
  
  // Fill addons
  await prisma.addons.upsert({
    where: { id: 1 },
    update: {},
    create: {},
  });

  // Finally, update version to skip future setups
  await prisma.serverSettings.update({ where: { id: 1 }, data: { lastSetupVersion: CURRENT_VERSION } });
  return; 
}

async function getTargetAdminUser(): Promise<string> {
  console.log('');
  const email = await input({
    message: "Enter the email of the user you would like to grant ADMIN privileges to:",
    required: true,
    validate: async (v) => {
      const user = await prisma.user.findUnique({ where: { email: v.trim() } });
      return !!user || 'No users could be found with that email.';
    },
  });
  return email;
}