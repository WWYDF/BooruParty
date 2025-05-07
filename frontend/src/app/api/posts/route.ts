import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/core/prisma";
import { SafetyType } from "@prisma/client";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/authServer";
import { reportAudit } from "@/components/serverSide/auditLog";
import { FILE_TYPE_MAP } from "@/core/dictionary";

export function parseSearch(input: string) {
  const terms = input.split(/\s+/).filter(Boolean);

  const includeTags: string[] = [];
  const excludeTags: string[] = [];
  const systemOptions: Record<string, string> = {};

  for (const term of terms) {
    if (term.startsWith("-")) {
      excludeTags.push(term.substring(1));
    } else if (term.includes(":")) {
      const [key, value] = term.split(":");
      if (key && value) {
        systemOptions[key] = value;
      }
    } else {
      includeTags.push(term);
    }
  }

  const typeMatches = [...input.matchAll(/(-)?type:([^\s]+)/g)];
  const includeTypes: string[] = [];
  const excludeTypes: string[] = [];

  for (const [, isNegated, val] of typeMatches) {
    const lower = val.toLowerCase();
    if (isNegated) excludeTypes.push(lower);
    else includeTypes.push(lower);
  }

  return { includeTags, excludeTags, includeTypes, excludeTypes, systemOptions };
}

// Fetch all posts with optional tags, sorting, etc.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const search = searchParams.get("query") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("perPage") || "50");
  const safetyValues = searchParams.getAll("safety");

  const { includeTags, excludeTags, systemOptions, includeTypes, excludeTypes } = parseSearch(search);

  const orderValue = systemOptions.order || "createdAt"; // default to createdAt
  let orderBy: any = { createdAt: "desc" };

  if (orderValue.startsWith("score")) {
    orderBy = { score: orderValue.endsWith("_asc") ? "asc" : "desc" };
  } else if (orderValue.startsWith("favorites")) {
    orderBy = { favoritedBy: { _count: orderValue.endsWith("_asc") ? "asc" : "desc" } };
  } else if (orderValue.startsWith("tags")) {
    orderBy = { tags: { _count: orderValue.endsWith("_asc") ? "asc" : "desc" } };
  } else {
    orderBy = { createdAt: "desc" }; // fallback
  }

  let fileTypeWhere: Record<string, any> = {};
  const resolveExts = (types: string[]) =>
    types.flatMap(t => {
      if (t in FILE_TYPE_MAP) return FILE_TYPE_MAP[t as keyof typeof FILE_TYPE_MAP];
      return [t]; // fallback: treat as literal extension
    }).map(ext => ext.replace(/^\./, ""));

  const includeExts = resolveExts(includeTypes);
  const excludeExts = resolveExts(excludeTypes);

  fileTypeWhere = {
    AND: [
      includeExts.length > 0 ? { fileExt: { in: includeExts } } : {},
      excludeExts.length > 0 ? { fileExt: { notIn: excludeExts } } : {},
    ],
  };
  

  const uploaderWhere = systemOptions.posts
  ? {
      uploadedBy: {
        is: {
          username: systemOptions.posts,
        },
      },
    }
  : {};

  const favoriterWhere = systemOptions.favorites
  ? {
      favoritedBy: {
        some: {
          user: {
            username: systemOptions.favorites,
          },
        },
      },
    }
  : {};

  const posts = await prisma.posts.findMany({
    where: {
      AND: [
        uploaderWhere,
        favoriterWhere,
        fileTypeWhere,
        ...(safetyValues.length > 0
          ? [{ safety: { in: safetyValues as SafetyType[] } }]
          : []),
        ...includeTags.map((tagName) => ({
          tags: { some: { name: tagName } },
        })),
        ...excludeTags.map((tagName) => ({
          tags: { none: { name: tagName } },
        })),
      ],
    },
    skip: (page - 1) * perPage,
    take: perPage,
    orderBy,
    select: {
      id: true,
      fileExt: true,
      safety: true,
      uploadedBy: {
        select: { id: true, username: true }
      },
      anonymous: true,
      flags: true,
      score: true,
      favoritedBy: {
        select: {
          userId: true
        }
      },
      comments: {
        select: {
          authorId: true,
          content: true
        }
      },
      createdAt: true,
      tags: { select: { id: true, name: true } },
    },
  });

  const totalCount = await prisma.posts.count({
    where: {
      AND: [
        uploaderWhere,
        ...includeTags.map((tagName) => ({
          tags: { some: { name: tagName } },
        })),
        ...excludeTags.map((tagName) => ({
          tags: { none: { name: tagName } },
        })),
      ],
    },
  });

  const totalPages = Math.ceil(totalCount / perPage);

  return NextResponse.json({
    posts,
    totalPages,
  });
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
  }

  try {
    if (deletable.length > 0) {
      await prisma.posts.deleteMany({ where: { id: { in: deletable } } });

      await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/delete/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: deletable }),
      });

      const forwarded = req.headers.get("x-forwarded-for");
      const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
      await reportAudit(session.user.id, 'DELETE', 'POST', ip, `Deleted Posts: ${deletable}`);
    }

    const statusCode = deletable.length > 0 && skipped.length > 0 ? 207 : 200;
    return NextResponse.json({ deleted: deletable, skipped }, { status: statusCode });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}