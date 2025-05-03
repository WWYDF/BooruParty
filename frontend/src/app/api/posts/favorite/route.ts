import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/core/prisma";
import { auth } from "@/core/authServer";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await req.json();
  if (!postId || typeof postId !== "number") {
    return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
  }

  const existing = await prisma.userFavorites.findUnique({
    where: {
      userId_postId: {
        userId: session.user.id,
        postId,
      },
    },
  });

  if (existing) {
    await prisma.userFavorites.delete({
      where: {
        userId_postId: {
          userId: session.user.id,
          postId,
        },
      },
    });
    return NextResponse.json({ favorited: false });
  } else {
    await prisma.userFavorites.create({
      data: {
        userId: session.user.id,
        postId,
      },
    });
    return NextResponse.json({ favorited: true });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const postId = parseInt(req.nextUrl.searchParams.get("postId") || "", 10);
  if (!postId) {
    return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
  }

  const favorited = await prisma.userFavorites.findUnique({
    where: {
      userId_postId: {
        userId: session.user.id,
        postId,
      },
    },
  });

  return NextResponse.json({ favorited: !!favorited });
}
