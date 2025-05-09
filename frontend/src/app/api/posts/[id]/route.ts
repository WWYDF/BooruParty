import { buildPostChangeDetails, reportAudit } from "@/components/serverSide/auditLog";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { syncPostPools } from "@/components/serverSide/Posts/syncPools";
import { syncPostRelations } from "@/components/serverSide/Posts/syncRelations";
import { auth } from "@/core/authServer";
import { getConversionType } from "@/core/dictionary";
import { prisma } from "@/core/prisma";
import { setAvatarUrl } from "@/core/reformatProfile";
import { NextRequest, NextResponse } from "next/server";

// GET endpoint to retrieve a single post by ID
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const permCheck = (await checkPermissions(['post_view']))['post_view'];
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
          },
          _count: {
            select: {
              posts: true
            }
          }
        }
      },
      specialPosts: true,
      relatedFrom: {
        include: {
          to: {
            select: {
              id: true,
              previewPath: true
            }
          }
        }
      },
      relatedTo: {
        include: {
          from: {
            select: {
              id: true,
              previewPath: true
            }
          }
        }
      },
      pools: {
        select: {
          poolId: true,
          pool: {
            select: {
              id: true,
              name: true,
              safety: true,
              _count: {
                select: { items: true }
              },
              items: {
                orderBy: { index: "asc" },
                select: {
                  index: true,
                  post: {
                    select: {
                      id: true,
                      previewPath: true,
                    },
                  },
                },
              },
            },
          },
        },
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
    pools: post.pools.map((poolItem) => ({
      ...poolItem,
      pool: {
        ...poolItem.pool,
        items: poolItem.pool.items.map((item) => ({
          ...item,
          post: {
            ...item.post,
            previewPath: `${process.env.NEXT_PUBLIC_FASTIFY}${item.post.previewPath}`,
          },
        })),
      },
    })),
  };

  const userFormatted = {
    vote: voteType,
    favorited: hasFavorited,
    signedIn: !!session?.user
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
  if (!session || !canEditOwnPost && !canEditOtherPosts) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { tags, sources, notes, safety, anonymous, relatedPosts, pools } = body;

    const originalPost = await prisma.posts.findUnique({
      where: { id: postId },
      select: {
        tags: { select: { id: true, name: true } },
        sources: true,
        notes: true,
        safety: true,
        anonymous: true,
        uploadedById: true
      },
    });

    if (!originalPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Permissions Check (Self)
    if (!canEditOtherPosts) {
      if (originalPost.uploadedById !== session.user.id) {
        return NextResponse.json({ error: "You are unauthorized to edit your own posts." }, { status: 403 });
      }
    }

    const updateData: any = {};

    // Optional field: tags
    if (tags !== undefined) {
      if (!Array.isArray(tags) || !tags.every((t) => typeof t === "number")) {
        return NextResponse.json({ error: "Invalid tags format" }, { status: 400 });
      }
      updateData.tags = {
        set: tags.map((tagId) => ({ id: tagId })),
      };
    }

    // Optional fields: strings, enums, booleans
    if (sources !== undefined) updateData.sources = sources;
    if (notes !== undefined) updateData.notes = notes;
    if (safety !== undefined) updateData.safety = safety;
    if (anonymous !== undefined) updateData.anonymous = anonymous;

    const updatedPost = await prisma.posts.update({
      where: { id: postId },
      data: updateData,
      include: {
        tags: { include: { category: true } },
      },
    });

    // Optional side effects
    if (relatedPosts !== undefined) {
      await syncPostRelations(postId, relatedPosts);
    }

    if (pools !== undefined) {
      await syncPostPools(postId, pools);
    }

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

// Use DELETE /api/posts with a single-value array to delete a single post.