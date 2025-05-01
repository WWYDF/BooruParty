import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/auth";
import { ALLOWED_EMBED_SOURCES } from "@/core/dictionary";
import { prisma } from "@/core/prisma";
import { setAvatarUrl } from "@/core/reformatProfile";
import { NextRequest, NextResponse } from "next/server";

const embedDomains = Object.keys(ALLOWED_EMBED_SOURCES);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postId = parseInt(searchParams.get("postId") || "");

  if (isNaN(postId)) {
    return NextResponse.json({ error: "Missing or invalid postId" }, { status: 400 });
  }

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

  const formattedComments = comments.map((comment) => ({
    ...comment,
    author: {
      ...comment.author,
      avatar: setAvatarUrl(comment.author.avatar),
    },
  }));

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
  // const embedPosts = await checkPermissions('comment_embed_post');
  const allowedEmbedDomains = ["cdn.discordapp.com", "media.tenor.com"];

  let isEmbed = false;

  if (embedURLs) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      const domain = new URL(match[0]).hostname;
      if (embedDomains.some((d) => domain.endsWith(d))) {
        isEmbed = true;
        break;
      }
    }
  }

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
