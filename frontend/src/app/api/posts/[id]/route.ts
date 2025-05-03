import { buildPostChangeDetails, reportAudit } from "@/components/serverSide/auditLog";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/authServer";
import { getConversionType } from "@/core/dictionary";
import { prisma } from "@/core/prisma";
import { setAvatarUrl } from "@/core/reformatProfile";
import { NextRequest, NextResponse } from "next/server";

// GET endpoint to retrieve a single post by ID
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const permCheck = (await checkPermissions(['posts_view']))['posts_view'];
    if (!permCheck) { return NextResponse.json({ error: "You are unauthorized to view posts." }, { status: 401 }); }
  } catch {}

  const { id } = await context.params;
  const session = await auth();

  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const post = await prisma.posts.findUnique({
    where: { id: postId },
    include: {
      tags: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          aliases: {
            select: {
              id: true,
              alias: true
            }
          }
        }
      },
      uploadedBy: {
        select: {
          id: true,
          username: true,
          role: true,
          avatar: true
        }
      },
      _count: {
        select: {
          favoritedBy: true
        }
      }
    }
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  let hasFavorited = false;
  let voteType = null;

  // If user is logged in, check their post statuses
  if (session?.user) {
    const userStatus = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        favorites: {
          where: { postId },
          select: { id: true }
        },
        votes: {
          where: { postId },
          select: { type: true }
        }
      }
    });

    hasFavorited = (userStatus?.favorites?.length ?? 0) > 0;
    voteType = userStatus?.votes?.[0]?.type ?? null;
  }

  // Might not need this anymore
  const previewExt = getConversionType(post.fileExt);

  const postFormatted = {
    ...post,
    uploadedBy: post.uploadedBy
      ? {
          ...post.uploadedBy,
          avatar: setAvatarUrl(post.uploadedBy.avatar)
        }
      : null,
    previewExt,
    previewPath: `${process.env.NEXT_PUBLIC_FASTIFY}${post.previewPath}`,
  }

  const userFormatted = {
    vote: voteType,
    favorited: hasFavorited,
  }

  return NextResponse.json({post: postFormatted, user: userFormatted});
}

// PATCH endpoint to update a post by ID
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const postId = parseInt(id);
  const session = await auth();

  const perms = await checkPermissions([
    'post_edit_own',
    'post_edit_others'
  ]);

  // Permissions Check
  const canEditOwnPost = perms['post_edit_own'];
  const canEditOtherPosts = perms['post_edit_others'];
  if (!session || !canEditOwnPost && !canEditOtherPosts) { return NextResponse.json({ error: "You are unauthorized to view the contents of this page." }, { status: 403 }); }

  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { tags, sources, notes, safety, anonymous } = body;

    if (!Array.isArray(tags) || !tags.every((t) => typeof t === "number")) {
      return NextResponse.json({ error: "Invalid tags format" }, { status: 400 });
    }

    const originalPost = await prisma.posts.findUnique({
      where: { id: postId },
      select: {
        tags: { select: { id: true } },
        sources: true,
        notes: true,
        safety: true,
        anonymous: true,
      }
    });

    const updatedPost = await prisma.posts.update({
      where: { id: postId },
      data: {
        tags: {
          set: tags.map((tagId) => ({ id: tagId })),
        },
        sources,
        notes,
        safety,
        anonymous,
      },
      include: {
        tags: {
          include: { category: true },
        },
      },
    });

    // Log action, but log nothing if nothing changed.
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
    const changeDetails = buildPostChangeDetails(originalPost, updatedPost);
    if (changeDetails.includes("Changes:")) { await reportAudit(session.user.id, 'EDIT', 'POST', ip, changeDetails); }

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error("PATCH /api/posts/[id] error:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}