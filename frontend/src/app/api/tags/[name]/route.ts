// app/api/tags/[name]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { fetchAllImplications } from "@/core/recursiveImplications";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { reportAudit } from "@/components/serverSide/auditLog";
import { auth } from "@/core/auth";

export async function GET(req: Request, context: { params: Promise<{ name: string }> }) {
  const tagName = (await context.params).name;

  // Try exact match
  let tag = await prisma.tags.findUnique({
    where: { name: tagName },
    include: {
      category: true,
      aliases: true,
      implications: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
        }
      },
      suggestions: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
        }
      },
    },
  });

  // If not found, try alias match
  if (!tag) {
    const alias = await prisma.tagAlias.findUnique({
      where: { alias: tagName },
      include: {
        tag: {
          include: {
            category: true,
            aliases: true,
            implications: {
              select: {
                id: true,
                name: true,
                description: true,
                category: true,
              }
            },
            suggestions: {
              select: {
                id: true,
                name: true,
                description: true,
                category: true,
              }
            },
          },
        },
      },
    });

    tag = alias?.tag ?? null;
  }

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const allImplications = await fetchAllImplications(tag.id);

  return NextResponse.json({
    ...tag,
    allImplications,
  });
}

export async function DELETE(req: Request, context: { params: Promise<{ name: string }> }) {
  const pram = (await context.params).name;
  const tagName = decodeURIComponent(pram);
  const session = await auth();

  const hasPerms = (await checkPermissions(['tags_delete']))['tags_delete'];
  if (!session || !hasPerms) { return NextResponse.json({ error: "You are unauthorized to delete tags." }, { status: 403 }); }

  try {
    const tag = await prisma.tags.findUnique({
      where: { name: tagName },
      select: { id: true },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Delete all aliases for the tag
    await prisma.tagAlias.deleteMany({
      where: { tagId: tag.id },
    });

    // Delete the tag itself
    await prisma.tags.delete({
      where: { id: tag.id },
    });

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
    await reportAudit(session.user.id, 'DELETE', 'TAG', ip, `Tag Name: ${tagName}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[TAG_DELETE]", err);
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ name: string }> }) {
  const pram = (await context.params).name;
  const oldName = decodeURIComponent(pram);
  const data = await req.json();
  const session = await auth();

  const hasPerms = (await checkPermissions(['tags_edit']))['tags_edit'];
  if (!session || !hasPerms) { return NextResponse.json({ error: "You are unauthorized to edit tags." }, { status: 403 }); }

  const {
    name: newName,
    aliases,
    description,
    categoryId,
    implications,
    suggestions,
  } = data;

  if (!newName || !Array.isArray(aliases) || !Array.isArray(implications) || !Array.isArray(suggestions)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const tag = await prisma.tags.findUnique({
      where: { name: oldName },
      select: { id: true },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found." }, { status: 404 });
    }

    const tagId = tag.id;

    // 1. Update the tag itself
    await prisma.tags.update({
      where: { id: tagId },
      data: {
        name: newName,
        description,
        categoryId,
      },
    });

    // 2. Delete old aliases and recreate
    await prisma.tagAlias.deleteMany({
      where: { tagId },
    });

    const aliasData = aliases.map((alias: string) => ({
      alias,
      tagId,
    }));

    if (aliasData.length > 0) {
      await prisma.tagAlias.createMany({
        data: aliasData,
      });
    }

    // 3. Update implications
    await prisma.tags.update({
      where: { id: tagId },
      data: {
        implications: {
          set: implications.map((id: number) => ({ id })),
        },
      },
    });

    // 4. Update suggestions
    await prisma.tags.update({
      where: { id: tagId },
      data: {
        suggestions: {
          set: suggestions.map((id: number) => ({ id })),
        },
      },
    });

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
    await reportAudit(session.user.id, 'DELETE', 'TAG', ip, `Tag ID: ${tagId}, Old Name: ${oldName}, New Name: ${newName}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[TAG_UPDATE]", err);
    return NextResponse.json({ error: "Failed to update tag." }, { status: 500 });
  }
}