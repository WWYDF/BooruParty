import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/core/prisma";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/authServer";
import { reportAudit } from "@/components/serverSide/auditLog";
import { buildPostWhereAndOrder } from "@/components/serverSide/Posts/filters";
import { parseSearch } from "@/components/serverSide/Posts/parseSearch";

// Fetch all posts with optional tags, sorting, etc.
export async function GET(req: Request) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  let userSafety: string[] = [];
  let userBlacklist: string[] = [];

  try {
    if (session?.user) {
      const userPrefs = await prisma.userPreferences.findUnique({
        where: { id: session.user.id },
        include: { blacklistedTags: { include: { category: true } } },
      });

      if (userPrefs) {
        userSafety = userPrefs.defaultSafety as string[];
        userBlacklist = userPrefs.blacklistedTags.map(tag => tag.name.toLowerCase());
      }
    } else {
      // Use defaults for guests
      const guestSafety = process.env.GUEST_SAFETY;
      if (guestSafety) {
        userSafety = guestSafety
          .split(",")
          .map(s => s.trim().toUpperCase())
          .filter(Boolean);
      } else {
        userSafety = ["SAFE"];
      }
    }
  } catch (e) {
    console.error(e);
  }

  const rawQuery = searchParams.get("query") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("perPage") || "50");
  const sort = (searchParams.get("sort") ?? "new") as "new" | "old";

  // Authoritative safety from query (if present), else fall back to user defaults
  const safetyValues = searchParams.getAll("safety");
  const effectiveSafetyArray =
    safetyValues.length > 0
      ? safetyValues.map(s => s.trim().toUpperCase()).filter(Boolean)
      : userSafety;

  // Build the base where/order using the safety array
  const parsed = parseSearch(rawQuery);
  const trimmed = rawQuery.trim();
  const { where, orderBy, useFavoriteOrdering, useLikesOrdering } = buildPostWhereAndOrder(rawQuery, effectiveSafetyArray, sort, userBlacklist);
  
  // If parseSearch exposes a freeText/remainingText field, prefer it. Otherwise derive:
  const freeText =
  (parsed as any).freeText ??
  trimmed
    // remove known key:value tokens that we already turned into structural filters
    .replace(/(?:^|\s)(posts|favorites|likes|pool|order|year|type|filter):\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Only create a text filter if there's actual free text left
  const textFilter =
  freeText.length > 0
    ? {
        OR: [
          { notes: { contains: freeText, mode: "insensitive" } },
          {
            tags: {
              some: {
                name: { contains: freeText, mode: "insensitive" },
              },
            },
          },
          {
            uploadedBy: {
              is: {
                username: { contains: freeText, mode: "insensitive" },
              },
            },
          },
        ],
      }
    : undefined;

  // Safety/structural filters must always apply; text is optional
  const finalWhere = textFilter ? { AND: [where, textFilter] } : where;

  const postSelect = {
    id: true,
    fileExt: true,
    safety: true,
    uploadedBy: {
      select: {
        id: true,
        username: true,
      },
    },
    notes: true,
    anonymous: true,
    flags: true,
    score: true,
    createdAt: true,
    _count: {
      select: {
        favoritedBy: true,
        comments: true,
        votes: true,
      },
    },
    comments: {
      select: {
        authorId: true,
        content: true,
      },
    },
    relatedFrom: {
      select: {
        toId: true,
      },
    },
    pools: {
      select: {
        poolId: true,
      },
    },
    tags: {
      include: {
        category: true,
      },
    },
  };

  let posts;

  if (useFavoriteOrdering) {
    const favorites = await prisma.userFavorites.findMany({
      where: {
        user: { username: parsed.systemOptions.favorites },
        post: finalWhere, // apply final filters
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        post: { select: postSelect },
      },
    });
    posts = favorites.map(f => f.post);

  } else if (useLikesOrdering) {
    const likes = await prisma.votes.findMany({
      where: {
        type: "UPVOTE",
        user: {
          is: {
            username: { equals: parsed.systemOptions.likes, mode: "insensitive" },
          },
        },
        post: finalWhere, // apply final filters
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        post: { select: postSelect },
      },
    });
    posts = likes.map(l => l.post);

  } else {
    posts = await prisma.posts.findMany({
      where: finalWhere, // no OR that bypasses safety
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy,
      select: postSelect,
    });
  }

  // Count should match final filters
  const totalCount = await prisma.posts.count({ where: finalWhere });
  const totalPages = Math.ceil(totalCount / perPage);

  return NextResponse.json({ posts, totalPages, totalPosts: totalCount });
}


// Delete one or more posts by supplying an array body
// Deletes posts the user has access to and skips over ones they dont
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  let { postIds } = body;

  if (typeof postIds === "number") postIds = [postIds];

  if (!Array.isArray(postIds) || postIds.some((id) => typeof id !== "number")) {
    return NextResponse.json({ error: "Invalid postIds array" }, { status: 400 });
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const perms = await checkPermissions(["post_delete_own", "post_delete_others"]);
  const canDeleteOwn = perms["post_delete_own"];
  const canDeleteOthers = perms["post_delete_others"];

  if (!canDeleteOwn && !canDeleteOthers) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const foundPosts = await prisma.posts.findMany({
    where: { id: { in: postIds } },
    select: { id: true, uploadedById: true }
  });

  const deletable: number[] = [];
  const skipped: { id: number; reason: string }[] = [];

  for (const id of postIds) {
    const post = foundPosts.find(p => p.id === id);

    if (!post) {
      skipped.push({ id, reason: "Post not found" });
      continue;
    }

    const isOwner = post.uploadedById === session.user.id;
    if (isOwner && canDeleteOwn) {
      deletable.push(id);
    } else if (!isOwner && canDeleteOthers) {
      deletable.push(id);
    } else {
      skipped.push({ id, reason: "Not authorized" });
    }

    // Unlink specialPosts to prevent errors
    await prisma.specialPosts.deleteMany({
      where: {
        postId: id
      }
    })
  }

  try {
    if (deletable.length > 0) {
      // Unhook from pools first
      await prisma.poolItems.deleteMany({ where: { postId: { in: deletable } } });

      await prisma.posts.deleteMany({ where: { id: { in: deletable } } });

      await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/delete/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: deletable }),
      });

      const forwarded = req.headers.get("x-forwarded-for");
      const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
      await reportAudit(session.user.id, 'DELETE', 'POST', ip, `Deleted Posts. Changes:\n${deletable.join('\n- ')}`);
    }

    const statusCode = deletable.length > 0 && skipped.length > 0 ? 207 : 200;
    return NextResponse.json({ deleted: deletable, skipped }, { status: statusCode });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}