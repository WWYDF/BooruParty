import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/auth";
import { ALLOWED_EMBED_SOURCES } from "@/core/dictionary";
import { prisma } from "@/core/prisma";
import { setAvatarUrl } from "@/core/reformatProfile";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postId = parseInt(searchParams.get("postId") || "");
  const session = await auth();
  const userId = session?.user?.id;

  if (isNaN(postId)) {
    return NextResponse.json({ error: "Missing or invalid postId" }, { status: 400 });
  }

  let canEditOwn = false;
  let canEditOthers = false;
  let canDeleteOthers = false;

  const comments = await prisma.comments.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          role: true,
          avatar: true
        }
      }
    }
  });

  // Only check perms if there are any comments to speed things up
  if (comments.length > 0) {
    [canEditOwn, canEditOthers, canDeleteOthers] = await Promise.all([
      checkPermissions("comment_edit_own"),
      checkPermissions("comment_edit_others"),
      checkPermissions("comment_delete_others"),
    ]);
  }

  const commentIds = comments.map((c) => c.id);

  const [voteAggregates, userVotes] = await Promise.all([
    prisma.commentVotes.groupBy({
      by: ["commentId"],
      where: { commentId: { in: commentIds } },
      _sum: { vote: true },
    }),
    userId
      ? prisma.commentVotes.findMany({
          where: {
            commentId: { in: commentIds },
            userId,
          },
          select: {
            commentId: true,
            vote: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const scoreMap = Object.fromEntries(
    voteAggregates.map((v) => [v.commentId, v._sum.vote ?? 0])
  );

  const userVoteMap = Object.fromEntries(
    userVotes.map((v) => [v.commentId, v.vote])
  );

  const formattedComments = comments.map((comment) => {
    const isOwn = comment.author.id === session?.user.id;
  
    const canEdit =
      (canEditOwn && isOwn) ||
      (canEditOthers && !isOwn);
  
    const canDelete =
      isOwn || canDeleteOthers;
  
    return {
      ...comment,
      author: {
        ...comment.author,
        avatar: setAvatarUrl(comment.author.avatar),
      },
      score: scoreMap[comment.id] ?? 0,
      userVote: userVoteMap[comment.id] ?? 0,
      canEdit,
      canDelete,
    };
  });

  return NextResponse.json(formattedComments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { postId, content } = body;

  if (!postId || !content?.trim()) {
    return NextResponse.json({ error: "Missing postId or content" }, { status: 400 });
  }

  // --- Check for embed permission
  const canComment = await checkPermissions('comment_create');
  const embedURLs = await checkPermissions('comment_embed_url');
  const embedPosts = await checkPermissions('comment_embed_post');

  const urlRegex = /https?:\/\/[^\s]+/g;
  const postRegex = /:(\d+):/g;

  let hasURLEmbed = false;
  let hasPostEmbed = false;

  if (embedURLs && urlRegex.test(content)) {
    const matches = content.match(urlRegex) || [];
    for (const url of matches) {
      try {
        const domain = new URL(url).hostname;
        if (Object.keys(ALLOWED_EMBED_SOURCES).some((d) => domain.endsWith(d))) {
          hasURLEmbed = true;
          break;
        }
      } catch {}
    }
  }

  if (embedPosts && postRegex.test(content)) {
    hasPostEmbed = true;
  }

  const isEmbed = hasURLEmbed || hasPostEmbed;

  const comment = await prisma.comments.create({
    data: {
      postId,
      content,
      authorId: session.user.id,
      isEmbed,
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
