import { NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { subDays } from 'date-fns';
import { checkPermissions } from '@/components/serverSide/permCheck';

export async function GET() {
  const hasPerms = (await checkPermissions(['dashboard_analytics']))['dashboard_analytics'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  const now = new Date();
  const weekAgo = subDays(now, 7);
  const dayAgo = subDays(now, 1);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    totalPosts,
    uploadsThisWeek,
    flaggedPosts,
    postsWithNotes,
    safePosts,
    sketchyPosts,
    unsafePosts,
    totalUsers,
    usersThisWeek,
    usersActiveToday,
    admins,
    totalComments,
    totalVotes,
    totalFavorites,
    poolCount,
    postsInPools,
    auditToday,
    specialPosts,
    postsToday,
    postsDeletedToday
  ] = await Promise.all([
    prisma.posts.count(),
    prisma.posts.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.posts.count({ where: { flags: { isEmpty: false } } }),
    prisma.posts.count({ where: { notes: { not: null } } }),
    prisma.posts.count({ where: { safety: 'SAFE' } }),
    prisma.posts.count({ where: { safety: 'SKETCHY' } }),
    prisma.posts.count({ where: { safety: 'UNSAFE' } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { lastLogin: { gte: dayAgo } } }),
    prisma.user.count({ where: { roleId: { not: null } } }),
    prisma.comments.count(),
    prisma.votes.count(),
    prisma.userFavorites.count(),
    prisma.pools.count(),
    prisma.poolItems.count(),
    prisma.audits.count({ where: { executedAt: { gte: startOfDay } } }),
    prisma.specialPosts.count(),
    prisma.posts.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.audits.count({ where: { category: 'DELETE', actionType: 'POST', executedAt: { gte: startOfDay } } })
  ]);

  return NextResponse.json({
    totalPosts,
    uploadsThisWeek,
    flaggedPosts,
    postsWithNotes,
    safePosts,
    sketchyPosts,
    unsafePosts,
    totalUsers,
    usersThisWeek,
    usersActiveToday,
    admins,
    totalComments,
    totalVotes,
    totalFavorites,
    poolCount,
    postsInPools,
    auditToday,
    specialPosts,
    postsToday,
    postsDeletedToday,
  });
}
