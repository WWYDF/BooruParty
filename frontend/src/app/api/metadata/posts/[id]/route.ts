import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Tag } from '@/core/types/tags';
import { formatStorageFromBytes } from '@/core/formats';
import { Post } from '@/core/types/posts';
import { resolveFileType } from '@/core/dictionary';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts/${id}`, {
      cache: "no-store",
      headers: { // This might be insecure, change in future?
        'X-Override': `${process.env.INTERNAL_API_SECRET}`,
      },
    });

    if (res.status == 404) { return NextResponse.json({ error: 'Post not found.' }, { status: 404 }); }
    if (res.status == 401) { return NextResponse.json({ error: 'Guest viewing is disabled for this site, please login to view this post.' }, { status: 401 }); }

    const data = await res.json();
    const post: Post = data.post;

    let artistText = '';
    const firstArtist: Tag | undefined = post.tags.find(
      (tag: any) => tag.category?.name === "Artist" || tag.category?.name === "Artists"
    );
    if (firstArtist) { artistText = ` by ${firstArtist.name}` }
    
    let fileTypeText = '';
    const fileType = resolveFileType(`.${post.fileExt}`);
    if (fileType != 'other') { fileTypeText = ` ${fileType}` }

    let previewUrl = post.previewPath;
    if (process.env.GUEST_VIEWING !== 'true') {
      previewUrl = '/i/private.png'
    }
  
    return NextResponse.json({
      title: `Post #${post.id}${artistText}`,
      description: `View this ${formatStorageFromBytes(post.fileSize ?? 0)}${fileTypeText}`,
      safety: post.safety,
      previewUrl: previewUrl,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/post/${id}`,
    });
  } catch (error) {
    return NextResponse.json({ error })
  }
}
