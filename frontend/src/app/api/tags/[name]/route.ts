import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { fetchAllImplications, fetchTag } from "@/core/completeTags";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { reportAudit } from "@/components/serverSide/auditLog";
import { auth } from "@/core/authServer";

// Get Tag Information
export async function GET(req: Request, context: { params: Promise<{ name: string }> }) {
  const tagName = (await context.params).name;

  const tagData = await fetchTag(tagName);

  return NextResponse.json(tagData);
}

// Delete Tag
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

// Edit Tag
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

// Merge Tags
export async function POST(req: Request, context: { params: Promise<{ name: string }> }) {
  const pram = (await context.params).name;
  const sourceName = decodeURIComponent(pram);
  const { targetId, makeAlias } = await req.json();

  if (!targetId || typeof makeAlias !== "boolean") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const source = await prisma.tags.findUnique({
      where: { name: sourceName },
      select: { id: true, name: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source tag not found" }, { status: 404 });
    }

    const sourceId = source.id;

    if (sourceId === targetId) {
      return NextResponse.json({ error: "Cannot merge a tag into itself." }, { status: 400 });
    }

    // Step 1: Move Post usages
    const posts = await prisma.posts.findMany({
      where: {
        tags: {
          some: { id: sourceId },
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(
      posts.map((post: any) =>
        prisma.posts.update({
          where: { id: post.id },
          data: {
            tags: {
              disconnect: { id: sourceId },
              connect: { id: targetId },
            },
          },
        })
      )
    );

    // Step 2: Move Implications (both directions)

    // Implications where source → other
    const implies = await prisma.tags.findMany({
      where: {
        impliedBy: {
          some: { id: sourceId },
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(
      implies.map((tag: any) =>
        prisma.tags.update({
          where: { id: tag.id },
          data: {
            impliedBy: {
              disconnect: { id: sourceId },
              connect: { id: targetId },
            },
          },
        })
      )
    );

    // Implications where other → source
    const impliedBy = await prisma.tags.findMany({
      where: {
        implications: {
          some: { id: sourceId },
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(
      impliedBy.map((tag: any) =>
        prisma.tags.update({
          where: { id: tag.id },
          data: {
            implications: {
              disconnect: { id: sourceId },
              connect: { id: targetId },
            },
          },
        })
      )
    );

    // Step 3: Move Suggestions (both directions)

    // Suggestions where source → other
    const suggests = await prisma.tags.findMany({
      where: {
        suggestedBy: {
          some: { id: sourceId },
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(
      suggests.map((tag: any) =>
        prisma.tags.update({
          where: { id: tag.id },
          data: {
            suggestedBy: {
              disconnect: { id: sourceId },
              connect: { id: targetId },
            },
          },
        })
      )
    );

    // Suggestions where other → source
    const suggestedBy = await prisma.tags.findMany({
      where: {
        suggestions: {
          some: { id: sourceId },
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(
      suggestedBy.map((tag: any) =>
        prisma.tags.update({
          where: { id: tag.id },
          data: {
            suggestions: {
              disconnect: { id: sourceId },
              connect: { id: targetId },
            },
          },
        })
      )
    );

    // Step 4: Optionally create an alias for source name
    if (makeAlias) {
      const exists = await prisma.tagAlias.findFirst({
        where: { alias: source.name },
      });

      if (!exists) {
        await prisma.tagAlias.create({
          data: {
            alias: source.name,
            tagId: targetId,
          },
        });
      }
    }

    // Step 5: Clean up: Delete source tag
    await prisma.tagAlias.deleteMany({
      where: { tagId: sourceId },
    });

    await prisma.tags.delete({
      where: { id: sourceId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[TAG_MERGE]", err);
    return NextResponse.json({ error: "Failed to merge tag." }, { status: 500 });
  }
}
