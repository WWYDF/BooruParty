import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { checkPermissions } from '@/components/serverSide/permCheck';
import AdmZip from 'adm-zip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const hasPerms = (await checkPermissions(['dashboard_backups']))['dashboard_backups'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let jsonData: any = null;

    if (file.name.endsWith('.zip')) {
      const zip = new AdmZip(buffer);
      const entry = zip.getEntry('booru_backup.json');

      if (!entry) {
        return NextResponse.json({ error: 'Missing booru_backup.json in archive' }, { status: 400 });
      }

      const jsonText = zip.readAsText(entry);
      jsonData = JSON.parse(jsonText);
    } else if (file.name.endsWith('.json')) {
      jsonData = JSON.parse(buffer.toString('utf-8'));
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Wipe tables (child > parent)
    await prisma.$transaction([
      prisma.importLog.deleteMany(),
      prisma.importSession.deleteMany(),
      prisma.audits.deleteMany(),
      prisma.commentVotes.deleteMany(),
      prisma.comments.deleteMany(),
      prisma.poolVotes.deleteMany(),
      prisma.poolItems.deleteMany(),
      prisma.pools.deleteMany(),
      prisma.specialPosts.deleteMany(),
      prisma.postRelation.deleteMany(),
      prisma.votes.deleteMany(),
      prisma.userFavorites.deleteMany(),
      prisma.posts.deleteMany(),
      prisma.userPreferences.deleteMany(),
      prisma.user.deleteMany(),
      prisma.role.deleteMany(),
      prisma.permission.deleteMany(),
      prisma.tagAlias.deleteMany(),
      prisma.tags.deleteMany(),
      prisma.tagCategories.deleteMany(),
      prisma.siteSettings.deleteMany(),
    ]);

    // Insert in order
    await prisma.siteSettings.createMany({ data: jsonData.siteSettings || [] });
    await prisma.tagCategories.createMany({ data: jsonData.tagCategories || [] });

    await prisma.tags.createMany({
      data: (jsonData.tags || []).map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        categoryId: tag.categoryId,
        createdAt: tag.createdAt,
      })),
    });

    await prisma.tagAlias.createMany({
      data: jsonData.tagAliases || [],
    });

    await prisma.permission.createMany({ data: jsonData.permissions || [] });
    await prisma.role.createMany({ data: jsonData.roles?.map((r: any) => ({
      id: r.id,
      name: r.name
    })) || [] });

    for (const tag of jsonData.tags || []) {
      // Connect implications (Tag A implies B)
      if (tag.implications?.length) {
        await prisma.tags.update({
          where: { id: tag.id },
          data: {
            implications: {
              connect: tag.implications.map((t: any) => ({ id: t.id })),
            },
          },
        });
      }
    
      // Connect suggestions (Tag A suggests B)
      if (tag.suggestions?.length) {
        await prisma.tags.update({
          where: { id: tag.id },
          data: {
            suggestions: {
              connect: tag.suggestions.map((t: any) => ({ id: t.id })),
            },
          },
        });
      }
    }

    // Permissions per role
    for (const role of jsonData.roles || []) {
      if (role.permissions?.length) {
        await prisma.role.update({
          where: { id: role.id },
          data: {
            permissions: {
              connect: role.permissions.map((p: any) => ({ id: p.id }))
            }
          }
        });
      }
    }

    await prisma.user.createMany({ data: jsonData.users?.map((u: any) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      password: u.password,
      avatar: u.avatar,
      description: u.description,
      roleId: u.roleId,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin
    })) || [] });

    await prisma.posts.createMany({ data: jsonData.posts?.map((p: any) => ({
      ...p,
      tags: undefined,
      comments: undefined,
      votes: undefined,
      favoritedBy: undefined,
      specialPosts: undefined,
      pools: undefined,
      relatedTo: undefined,
      relatedFrom: undefined,
    })) || [] });

    await prisma.userPreferences.createMany({ data: jsonData.userPreferences || [] });
    await prisma.userFavorites.createMany({ data: jsonData.userFavorites || [] });
    await prisma.votes.createMany({ data: jsonData.votes || [] });

    await prisma.specialPosts.createMany({ data: jsonData.specialPosts || [] });
    await prisma.postRelation.createMany({ data: jsonData.postRelations || [] });
    
    await prisma.comments.createMany({ data: jsonData.comments || [] });
    await prisma.commentVotes.createMany({ data: jsonData.commentVotes || [] });

    await prisma.pools.createMany({ data: jsonData.pools?.map((p: any) => ({
      id: p.id,
      name: p.name,
      artist: p.artist,
      description: p.description,
      safety: p.safety,
      yearStart: p.yearStart,
      yearEnd: p.yearEnd,
      score: p.score,
      lastEdited: p.lastEdited,
      createdAt: p.createdAt
    })) || [] });
    await prisma.poolItems.createMany({ data: jsonData.poolItems || [] });
    await prisma.poolVotes.createMany({ data: jsonData.poolVotes || [] });

    await prisma.audits.createMany({ data: jsonData.audits || [] });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[IMPORT FAILED]', e);
    return NextResponse.json({ error: 'Import failed.' }, { status: 500 });
  }
}
