import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";
import { setAvatarUrl } from "@/core/reformatProfile";
import { checkPermissions } from "@/components/serverSide/permCheck";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const hasPerms = (await checkPermissions(['profile_view']))['profile_view'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to view users." }, { status: 403 }); }

  const page = parseInt(searchParams.get("page") || "1");
  const TAKE = 12; // Hardcode this for now

  const users = await prisma.user.findMany({
    skip: (page - 1) * TAKE,
    take: 50,
    orderBy: { lastLogin: 'desc' },
    select: {
      id: true,
      username: true,
      avatar: true,
      description: true,
      role: {
        select: {
          name: true,
          color: true
        }
      },
      _count: {
        select: {
          favorites: true,
          comments: true,
        },
      },
      lastLogin: true,
      createdAt: true,
    }
  });

  const totalCount = await prisma.user.count();
  const totalPages = Math.ceil(totalCount / TAKE);

  const usersWithAvatar = users
    .filter(user => user.id !== "0") // Don't show the 'deleted' user.
    .map(user => ({
      ...user,
    avatar: setAvatarUrl(user.avatar)
  }));

  return NextResponse.json({
    users: usersWithAvatar,
    totalPages
  });
}