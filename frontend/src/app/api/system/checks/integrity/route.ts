import { NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { checkPermissions } from '@/components/serverSide/permCheck';

export async function GET() {
  const hasPerms = (await checkPermissions(['dashboard_checks']))['dashboard_checks'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  try {
    const allPostIds = await prisma.posts.findMany({ select: { id: true } });
    const ids = allPostIds.map(p => String(p.id));
    
    const upstreamResp = await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/checks/integrity`, {
      method: 'POST',
      body: JSON.stringify(ids),
      headers: {
        'Content-Type': 'application/json'
      },
    });

    if (!upstreamResp.ok) { throw new Error(`Errored response (${upstreamResp.status}) from upstream.`) };
    const data = await upstreamResp.json();
    
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to export backup.' }, { status: 500 });
  }
}