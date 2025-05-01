import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { DISALLOWED_USERNAMES } from "@/core/dictionary";

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

    // Ensure default ADMIN role and permissions exist
    const adminRole = await prisma.role.upsert({
      where: { name: "ADMIN" },
      update: {},
      create: {
        name: "ADMIN",
        permissions: {
          connectOrCreate: [
            { where: { name: "administrator" }, create: { name: "administrator" } },
            { where: { name: "post_create" }, create: { name: "post_create" } },
            { where: { name: "post_edit_own" }, create: { name: "post_edit_own" } },
            { where: { name: "post_edit_others" }, create: { name: "post_edit_others" } },
            { where: { name: "post_delete_own" }, create: { name: "post_delete_own" } },
            { where: { name: "post_delete_others" }, create: { name: "post_delete_others" } },
            { where: { name: "comment_delete_own" }, create: { name: "comment_delete_own" } },
            { where: { name: "comment_delete_others" }, create: { name: "comment_delete_others" } },
            { where: { name: "profile_edit_own" }, create: { name: "profile_edit_own" } },
            { where: { name: "profile_edit_others" }, create: { name: "profile_edit_others" } },
            { where: { name: "upload_type_image" }, create: { name: "upload_type_image" } },
            { where: { name: "upload_type_animated" }, create: { name: "upload_type_animated" } },
            { where: { name: "upload_type_video" }, create: { name: "upload_type_video" } },
            { where: { name: "limit_upload_ignore" }, create: { name: "limit_upload_ignore" } },
            { where: { name: "tags_view" }, create: { name: "tags_view" } },
            { where: { name: "tags_edit" }, create: { name: "tags_edit" } },
            { where: { name: "tags_delete" }, create: { name: "tags_delete" } },
            { where: { name: "tags_create" }, create: { name: "tags_create" } },
            { where: { name: "tags_categories_manage" }, create: { name: "tags_categories_manage" } },
            { where: { name: "dashboard_view" }, create: { name: "dashboard_view" } },
            { where: { name: "dashboard_settings" }, create: { name: "dashboard_settings" } },
            { where: { name: "posts_view" }, create: { name: "posts_view" } },
          ],
        },
      },
    });

    await prisma.role.upsert({
      where: { name: "MODERATOR" },
      update: {},
      create: {
        name: "MODERATOR",
        permissions: {
          connectOrCreate: [
            { where: { name: "post_create" }, create: { name: "post_create" } },
            { where: { name: "post_edit_own" }, create: { name: "post_edit_own" } },
            { where: { name: "post_edit_others" }, create: { name: "post_edit_others" } },
            { where: { name: "post_delete_own" }, create: { name: "post_delete_own" } },
            { where: { name: "post_delete_others" }, create: { name: "post_delete_others" } },
            { where: { name: "comment_delete_own" }, create: { name: "comment_delete_own" } },
            { where: { name: "comment_delete_others" }, create: { name: "comment_delete_others" } },
            { where: { name: "profile_edit_own" }, create: { name: "profile_edit_own" } },
            { where: { name: "profile_edit_others" }, create: { name: "profile_edit_others" } },
            { where: { name: "upload_type_image" }, create: { name: "upload_type_image" } },
            { where: { name: "upload_type_animated" }, create: { name: "upload_type_animated" } },
            { where: { name: "upload_type_video" }, create: { name: "upload_type_video" } },
            { where: { name: "limit_upload_ignore" }, create: { name: "limit_upload_ignore" } },
            { where: { name: "tags_view" }, create: { name: "tags_view" } },
            { where: { name: "tags_edit" }, create: { name: "tags_edit" } },
            { where: { name: "tags_delete" }, create: { name: "tags_delete" } },
            { where: { name: "tags_create" }, create: { name: "tags_create" } },
            { where: { name: "dashboard_view" }, create: { name: "dashboard_view" } },
            { where: { name: "posts_view" }, create: { name: "posts_view" } },
          ],
        },
      },
    });

    await prisma.role.upsert({
      where: { name: "POWER USER" },
      update: {},
      create: {
        name: "POWER USER",
        permissions: {
          connectOrCreate: [
            { where: { name: "post_create" }, create: { name: "post_create" } },
            { where: { name: "post_edit_own" }, create: { name: "post_edit_own" } },
            { where: { name: "post_delete_own" }, create: { name: "post_delete_own" } },
            { where: { name: "comment_delete_own" }, create: { name: "comment_delete_own" } },
            { where: { name: "profile_edit_own" }, create: { name: "profile_edit_own" } },
            { where: { name: "upload_type_image" }, create: { name: "upload_type_image" } },
            { where: { name: "upload_type_animated" }, create: { name: "upload_type_animated" } },
            { where: { name: "upload_type_video" }, create: { name: "upload_type_video" } },
            { where: { name: "limit_upload_ignore" }, create: { name: "limit_upload_ignore" } },
            { where: { name: "tags_view" }, create: { name: "tags_view" } },
            { where: { name: "posts_view" }, create: { name: "posts_view" } },
          ],
        },
      },
    });

    await prisma.role.upsert({
      where: { name: "MEMBER" },
      update: {},
      create: {
        name: "MEMBER",
        permissions: {
          connectOrCreate: [
            { where: { name: "post_create" }, create: { name: "post_create" } },
            { where: { name: "post_edit_own" }, create: { name: "post_edit_own" } },
            { where: { name: "post_delete_own" }, create: { name: "post_delete_own" } },
            { where: { name: "comment_delete_own" }, create: { name: "comment_delete_own" } },
            { where: { name: "profile_edit_own" }, create: { name: "profile_edit_own" } },
            { where: { name: "upload_type_image" }, create: { name: "upload_type_image" } },
            { where: { name: "upload_type_animated" }, create: { name: "upload_type_animated" } },
            { where: { name: "tags_view" }, create: { name: "tags_view" } },
            { where: { name: "posts_view" }, create: { name: "posts_view" } },
          ],
        },
      },
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
    
      await prisma.user.create({
        data: {
          email,
          username,
          password: hashed,
          roleId: adminRole.id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Setup error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
