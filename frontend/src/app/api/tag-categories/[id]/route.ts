import { reportAudit } from "@/components/serverSide/auditLog";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/authServer";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const body = await req.json();
  const { name, color, order } = body;
  const session = await auth();

  const hasPerms = (await checkPermissions(['tags_categories_manage']))['tags_categories_manage'];
  if (!session || !hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  const updated = await prisma.tagCategories.update({
    where: { id: parseInt(id) },
    data: { name, color, order },
  });

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const changeDetails = `Edited Category: ${id}\nChanges:\n- Name: ${name}\n- Color: ${color}\n- Order: ${order}}`;
  await reportAudit(session.user.id, 'EDIT', 'CATEGORY', ip, changeDetails);

  return NextResponse.json(updated);
}


export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const categoryId = parseInt(id, 10);
  const { searchParams } = new URL(req.url);
  const purgeTags = searchParams.get("purgeTags") === "true";
  // AKA, if purgeTags exists in the params, fire it.
  const session = await auth();

  if (isNaN(categoryId)) {
    return new Response("Invalid category ID", { status: 400 });
  }

  const perms = await checkPermissions([
    'tags_delete',
    'tags_categories_manage'
  ]);

  const canDeleteTags = perms['tags_delete'];
  const canManageCategories = perms['tags_categories_manage'];

  if (!session || !canManageCategories) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  try {
    if (purgeTags) {
      if (!canDeleteTags) { return NextResponse.json({ error: "You are unauthorized to delete tags." }, { status: 403 }); }

      const tags = await prisma.tags.findMany({
        where: { categoryId },
        include: {
          posts: { select: { id: true } },
          aliases: true,
          implications: true,
          impliedBy: true,
          suggestions: true,
          suggestedBy: true,
        },
      });

      for (const tag of tags) {
        // Disconnect tag from all posts
        for (const post of tag.posts) {
          await prisma.posts.update({
            where: { id: post.id },
            data: {
              tags: {
                disconnect: { id: tag.id },
              },
            },
          });
        }

        // Disconnect implications and suggestions
        await prisma.tags.update({
          where: { id: tag.id },
          data: {
            implications: { set: [] },
            impliedBy: { set: [] },
            suggestions: { set: [] },
            suggestedBy: { set: [] },
          },
        });

        // Delete aliases
        if (tag.aliases.length > 0) {
          await prisma.tagAlias.deleteMany({
            where: { tagId: tag.id },
          });
        }
      }

      // Delete all tags in the category
      await prisma.tags.deleteMany({
        where: { id: { in: tags.map(t => t.id) } },
      });
    }

    // Delete the tag category
    await prisma.tagCategories.delete({
      where: { id: categoryId },
    });


    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
    const changeDetails = `Deleted Category: ${id} | Deleted Tags: ${purgeTags}}`;
    await reportAudit(session.user.id, 'DELETE', 'CATEGORY', ip, changeDetails);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return new Response("Failed to delete category", { status: 500 });
  }
}
