import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/core/authServer';
import { checkFile } from '@/components/serverSide/UploadProcessing/checkHash';
import { resolveFileType } from '@/core/dictionary';
import { checkPermissions } from '@/components/serverSide/permCheck';

export async function POST(request: NextRequest) {
  const session = await auth();

  const perms = await checkPermissions([
    'post_create',
    'post_create_dupes',
  ]);

  const canCreatePosts = perms['post_create'];
  const canCreateDupes = perms['post_create_dupes'];

  if (!session || !canCreatePosts) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) { return NextResponse.json({ error: 'No file provided' }, { status: 400 }); };

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const fileType = resolveFileType(`.${extension}`);

  if (fileType === 'other') {
    return NextResponse.json(
      { error: `File type .${extension} is not supported.` },
      { status: 415 } // 415 Unsupported Media Type
    );
  }

  // Begin processing stuff
  const buffer = Buffer.from(await file.arrayBuffer());
  const checkMatch = await checkFile(buffer, extension, fileType);

  return NextResponse.json({ duplicate: checkMatch.status, dupePerms: canCreateDupes, post: checkMatch.ogPost?.id }, { status: checkMatch.status ? 409 : 200 });
}
