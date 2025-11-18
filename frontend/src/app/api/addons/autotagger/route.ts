import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/core/authServer';
import { checkPermissions } from '@/components/serverSide/permCheck';
import { fetchAutoTags } from '@/components/serverSide/autotag';

export async function POST(req: NextRequest) {
  const session = await auth();
  const perms = await checkPermissions(['post_edit_own', 'post_edit_others']);
  const canEditOwnPost = perms['post_edit_own'];
  const canEditOtherPosts = perms['post_edit_others'];
  if (!session || (!canEditOwnPost && !canEditOtherPosts)) {
    return NextResponse.json({ error: 'You are unauthorized to use this endpoint.' }, { status: 403 });
  }

  try {
    const { imageUrl } = (await req.json()) as { imageUrl: string };
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });

    const { matches, nonMatched } = await fetchAutoTags(imageUrl)
    return NextResponse.json({ matches, nonMatched });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'AutoTagger Format Failure' }, { status: 500 });
  }
}
