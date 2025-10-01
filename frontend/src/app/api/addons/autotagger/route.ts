import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { checkPermissions } from '@/components/serverSide/permCheck';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();
  const perms = await checkPermissions([
    'post_edit_own',
    'post_edit_others'
  ]);

  // Permissions Check
  const canEditOwnPost = perms['post_edit_own'];
  const canEditOtherPosts = perms['post_edit_others'];
  if (!session || !canEditOwnPost && !canEditOtherPosts) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  try {
    const { imageUrl } = (await req.json()) as { imageUrl: string };
    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });
    }

    // Read your configured URL from DB (singleton row)
    const cfg = await prisma.addonsConfig.findUnique({ where: { id: 1 } });
    if (!cfg?.autoTagger || !cfg.autoTaggerUrl) {
      return NextResponse.json({ error: 'Autotagger disabled' }, { status: 400 });
    }

    // Fetch the image server-side
    const imgRes = await fetch(imageUrl, { redirect: 'follow' });
    if (!imgRes.ok) {
      return NextResponse.json({ error: `image fetch ${imgRes.status}` }, { status: 502 });
    }
    const blob = await imgRes.blob();

    // Forward to autotagger
    const fd = new FormData();
    fd.append('file', new File([blob], 'preview', { type: blob.type || 'image/jpeg' }));
    fd.append('format', 'json');

    const r = await fetch(cfg.autoTaggerUrl, { method: 'POST', body: fd });
    if (!r.ok) {
      return NextResponse.json({ error: `AutoTagger: ${r.status}` }, { status: 502 });
    }

    // Pass JSON through
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Proxy Failure' }, { status: 500 });
  }
}
