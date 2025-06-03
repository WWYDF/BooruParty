import { NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import JSZip from 'jszip';

export async function GET() {
  try {
    const data = {
      exportedAt: new Date().toISOString(),

      siteSettings: await prisma.siteSettings.findMany(),

      users: await prisma.user.findMany({
        include: {
          preferences: true,
          favorites: true,
          votes: true,
          comments: true,
          commentVotes: true,
          poolVotes: true,
          audits: true,
          role: true,
        },
      }),

      userPreferences: await prisma.userPreferences.findMany(),
      userFavorites: await prisma.userFavorites.findMany(),
      votes: await prisma.votes.findMany(),
      commentVotes: await prisma.commentVotes.findMany(),

      roles: await prisma.role.findMany({ include: { permissions: true } }),
      permissions: await prisma.permission.findMany(),

      posts: await prisma.posts.findMany({
        include: {
          tags: true,
          votes: true,
          comments: true,
          favoritedBy: true,
          specialPosts: true,
          pools: true,
          relatedTo: true,
          relatedFrom: true,
        },
      }),

      specialPosts: await prisma.specialPosts.findMany(),
      postRelations: await prisma.postRelation.findMany(),
      comments: await prisma.comments.findMany(),

      tags: await prisma.tags.findMany({
        include: {
          aliases: true,
          category: true,
          implications: true,
          impliedBy: true,
          suggestions: true,
          suggestedBy: true,
        },
      }),

      tagAliases: await prisma.tagAlias.findMany(),
      tagCategories: await prisma.tagCategories.findMany(),

      pools: await prisma.pools.findMany({ include: { items: true, votes: true } }),
      poolItems: await prisma.poolItems.findMany(),
      poolVotes: await prisma.poolVotes.findMany(),

      audits: await prisma.audits.findMany(),
    };

    const json = JSON.stringify(data, null, 2);

    const zip = new JSZip();
    zip.file('booru_backup.json', json);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="booru_backup.zip"',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to export backup.' }, { status: 500 });
  }
}