import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { DISALLOWED_USERNAMES } from "@/core/dictionary";
import { prismaPerms } from "@/core/constants/permissions";

// Get setup status
export async function GET() {
  const setup = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const user = await prisma.user.findFirst();

  return NextResponse.json({
    setupComplete: setup?.setupComplete ?? false,
    userExists: !!user,
  });
}

// Setup Server (tries to keep everything intact so this can be ran to update too)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { siteName, accent, darkerAccent, email, username, password } = body;

    const userExists = await prisma.user.findFirst();

    // Create or update SiteSettings
    await prisma.siteSettings.upsert({
      where: { id: 1 },
      update: {
        setupComplete: true,
        siteName,
        accent,
        darkerAccent,
      },
      create: {
        id: 1,
        setupComplete: true,
        siteName,
        accent,
        darkerAccent,
      },
    });

    // Flush Permissions
    await prisma.permission.deleteMany();

    // Setup Permissions
    await prisma.permission.createMany({
      data: prismaPerms // moved to an exported const for updatability
    })

    // Create Roles - DEFAULT REGISTRATION ROLE MUST BE FIRST!
    await prisma.role.upsert({
      where: { name: "Member" },
      update: {},
      create: { name: "Member", isDefault: true, index: 4 }
    })

    // RoleNames and RoleColors follow the same index.
    const roleNames = ["Admin", "Moderator", "Power User"];
    const roleColors = ["#fa5043", "#6d9ffd", "#f1cb07"]

    roleNames.forEach(async (name, i) => {
      await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, color: roleColors[i], index: i },
      });
    });

    // Setup Permissions - Ordered by increasing power
    const roleOrder: { name: string; ownPermissions: string[] }[] = [
      {
        name: "Member",
        ownPermissions: [
          "post_view",
          "post_create",
          "post_edit_own",
          "post_delete_own",
          "post_vote",
          "post_favorite",
          "comment_create",
          "comment_embed_post",
          "comment_edit_own",
          "comment_delete_own",
          "comment_vote",
          "pool_vote",
          "profile_create",
          "profile_view",
          "profile_edit_avatar",
          "upload_type_image",
          "upload_type_animated",
        ]
      },
      {
        name: "Power User",
        ownPermissions: [
          "post_create_dupes",
          "post_edit_others",
          "post_autotag",
          "comment_embed_url",
          "upload_type_video",
          "tags_create",
          "tags_edit",
          "profile_edit_background"
        ]
      },
      {
        name: "Moderator",
        ownPermissions: [
          "post_delete_others",
          "post_feature",
          "comment_edit_others",
          "comment_delete_others",
          "pool_create",
          "pool_manage",
          "pool_delete",
          "profile_archive_others",
          "limit_upload_ignore",
          "tags_delete",
          "dashboard_view",
          "dashboard_analytics",
          "dashboard_audit_log"
        ]
      },
      {
        name: "Admin",
        ownPermissions: [
          "profile_edit_others",
          "profile_edit_roles",
          "profile_delete_others",
          "tags_categories_manage",
          "dashboard_backups",
          "dashboard_import",
          "dashboard_update",
          "dashboard_roles",
          "dashboard_addons",
          "administrator"
        ]
      }
    ];

    // Get all permissions
    const allPermissions = await prisma.permission.findMany();
    const permissionMap = Object.fromEntries(allPermissions.map(p => [p.name, { name: p.name }]));

    // Accumulate permissions and assign
    let cumulativePermissions: string[] = [];

    for (const role of roleOrder) {
      cumulativePermissions = [...cumulativePermissions, ...role.ownPermissions];

      await prisma.role.update({
        where: { name: role.name },
        data: {
          permissions: {
            set: cumulativePermissions.map(name => permissionMap[name])
          }
        }
      });
    }

    // Setup deleted account
    await prisma.user.upsert({
      where: { id: "0" },
      update: {},
      create: {
        id: "0",
        username: "deleted",
        email: "deleted@system.local",
        password: "OJ9L1EWAjWy8ehj@", // this account isn't even allowed to sign in so this doesn't matter lol
        roleId: 1                     // but i figured i'd set it regardless
      }
    });

    // Only create user if none exists and credentials provided
    if (!userExists) {
      if (!email || !username || !password) {
        return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
      }
    
      if (DISALLOWED_USERNAMES.includes(username.toLowerCase())) {
        return NextResponse.json({ error: "Username is not allowed. Please choose another." }, { status: 400 });
      }
    
      const hashed = await hash(password, 12);

      const admin = await prisma.role.findFirst({
        where: { name: 'Admin' }
      })
    
      await prisma.user.create({
        data: {
          email,
          username,
          password: hashed,
          roleId: admin?.id ?? 3, // Admin should be in slot 3, but we double check anyways.
        },
      });
    }

    // Create default Tag Category if one doesn't exist
    const tagCategories = await prisma.tagCategories.findFirst({
      where: { isDefault: true }
    });

    // Update default if it does exist but isn't default for whatever reason
    // Otherwise, just create it (most cases)
    if (!tagCategories) {
      await prisma.tagCategories.upsert({
        where: { name: "Default" },
        update: {
          isDefault: true,
        },
        create: {
          name: "Default",
          color: "#3c9aff", //blue
          isDefault: true,
          order: 999 // last
        }
      })
    }

    // Seed Addons
    await prisma.addonsConfig.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {}
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Setup error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
