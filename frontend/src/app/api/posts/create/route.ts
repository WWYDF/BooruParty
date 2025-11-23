import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { checkFile } from '@/components/serverSide/UploadProcessing/checkHash';
import { resolveFileType } from '@/core/dictionary';
import { fetch, Agent, FormData } from 'undici';
import { FastifyUpload } from '@/core/types/posts';
import { checkPermissions } from '@/components/serverSide/permCheck';
import { fetchAutoTags } from '@/components/serverSide/autotag';
import { fetchTag } from '@/core/completeTags';

const fastify = process.env.NEXT_PUBLIC_FASTIFY;

export async function POST(request: NextRequest) {
  const session = await auth();

  const perms = await checkPermissions([
    'post_create',
    'post_create_dupes',
    'post_autotag'
  ]);

  const canCreatePosts = perms['post_create'];
  const canCreateDupes = perms['post_create_dupes'];
  const canAutoTag = perms['post_autotag'];

  if (!session || !canCreatePosts) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const { searchParams } = new URL(request.url);
  const skipDupeParam = searchParams.get("skipDupes") === "true";
  const autoTagParam = searchParams.get("autoTag") === "true";
  let skipDupes = false;
  const forceAutoTag = (autoTagParam && canAutoTag);

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (skipDupeParam) {
    const authHeader = request.headers.get('X-Override'); // Allow internal server pages to access regardless.
    if (canCreateDupes == true || authHeader && authHeader == process.env.INTERNAL_API_SECRET) { skipDupes = true }
  }

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
  if (checkMatch.status == true && skipDupes == false) {
    return Response.json({ duplicate: true, post: checkMatch.ogPost }, { status: 409 });
  }

  let addedTagsArray: string[] = [];

  const anonymous = formData.get('anonymous') === 'true';
  const safety = formData.get('safety') as 'SAFE' | 'SKETCHY' | 'UNSAFE';
  const rawTags = formData.get('tags') as string | null;
  const rawSource = formData.get("source") as string | string[] | null;

  const sources: string[] = Array.isArray(rawSource)
    ? rawSource
    : rawSource
    ? rawSource.split(/\s*,\s*/).filter(Boolean)
    : [];

  const notes = formData.get("notes") as string | null;
  const relPostRaw = formData.get("relatedPosts") as string | null;

  if (rawTags) {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) {
        addedTagsArray = parsed as string[];
      } else {
        addedTagsArray = [];
      }
    } catch {
      addedTagsArray = [];
    }
  }

  // console.log(addedTagsArray);

  const createdPost = await prisma.posts.create({
    data: {
      fileExt: extension,
      uploadedById: session.user.id,
      anonymous,
      safety,
      sources,
      notes,
      flags: [],
      pHash: checkMatch.genHash || null,
      dupeBypass: skipDupes,
      // fileSize: buffer.length,
    },
  });

  const postId = createdPost.id;

  // Handle relations if specified
  if (relPostRaw) {
    try {
      const relIds: unknown = JSON.parse(relPostRaw);
      if (!Array.isArray(relIds)) throw new Error("Expected array");
  
      const validIds = relIds
        .map((id) => Number(id))
        .filter((id) => !isNaN(id) && id !== postId);
  
      if (validIds.length > 0) {
        await prisma.postRelation.createMany({
          data: validIds.map((toId) => ({
            fromId: postId,
            toId,
          })),
          skipDuplicates: true,
        });
      }
    } catch (e) {
      console.error(`Error in adding post relation: ${e}`)
      return NextResponse.json({ error: "Invalid relatedPosts format" }, { status: 400 });
    }
  }

  const fastifyFormData = new FormData();
  fastifyFormData.append('postId', postId.toString());
  fastifyFormData.append('convert', false); // force false for now until Upload Page Revamp
  fastifyFormData.append('file', file);

  const fastifyResponse = await fetch(`${fastify}/api/upload`, {
    dispatcher: new Agent({ connectTimeout: 900 }),
    method: 'POST',
    body: fastifyFormData,
  });

  if (!fastifyResponse.ok) {
    // If Fastify upload fails, clean up by removing the post from Prisma
    await prisma.posts.delete({ where: { id: postId } });

    return NextResponse.json(
      { error: 'File upload to Fastify failed.' },
      { status: 500 }
    );
  }

  const fastifyResult = await fastifyResponse.json() as FastifyUpload;
  
  let previewSrc;
  if (fastifyResult.deletedPreview == true) { previewSrc = fastifyResult.originalPath; }
  else { previewSrc = fastifyResult.previewPath }

  // Add Tags non-destructively
  let tags;
  try {
    // Check for AutoTagger
    const autoTaggerConf = await prisma.addonsConfig.findFirst({
      where: { id: 1 },
      select: { autoTagger: true, autoTaggerMode: true, autoTaggerUrl: true}
    });
  
    if (
      fileType !== 'video' &&
      autoTaggerConf &&
      (autoTaggerConf.autoTaggerMode.includes('AGGRESSIVE') ||
        (autoTaggerConf.autoTaggerMode.includes('SELECTIVE') &&
        forceAutoTag)
      ) &&
      autoTaggerConf.autoTaggerUrl
    ) {
      const { matches } = await fetchAutoTags(undefined, file);
      
      for (const match of matches) {
        // prevent duplicates & add found tags
        if (!addedTagsArray.includes(match.tag.name)) { addedTagsArray.push(match.tag.name) };
      }
    }
  
    const addedTags = addedTagsArray.length > 0 ? JSON.stringify(addedTagsArray) : '';
  
    // Add Tags on Upload
    if (addedTags.length > 0) {
      let tagNames: string[];
      try {
        tagNames = JSON.parse(addedTags);
        if (!Array.isArray(tagNames)) throw new Error();
      } catch {
        return NextResponse.json({ error: "Invalid tag list format." }, { status: 400 });
      }
    
      // Force lowercase on all tag names
      tagNames = tagNames.map((n) => n.toLowerCase());

        // Use new function (prev. /tags/[name])
        const tagObjs = await Promise.all(tagNames.map((name) => fetchTag(name)));

        // Filter out any tags that didn't resolve
        const validTags = tagObjs.filter((t): t is NonNullable<typeof t> => !!t);

        if (validTags.length === 0) {
          console.warn('No valid tags found — skipping tag linking.');
        } else if (validTags.length < tagObjs.length) {
          const skipped = tagNames.filter((_, i) => !tagObjs[i]);
          console.warn(`Skipped invalid tags: ${skipped.join(', ')}`);
        }

        // Unionize
        const idSet = new Set<number>();
        for (const t of validTags) {
          idSet.add(t.id);
          if (t.allImplications?.length) {
            for (const imp of t.allImplications) idSet.add(imp.id);
          }
        }
        tags = Array.from(idSet).map((id) => ({ id }));
    }
  } catch (e) {
    console.error(`Skipping tags process due to:`, e);
  }

  // Update post with received stuff from Fastify / Tags
  await prisma.posts.update({
    where: { id: postId },
    data: {
      previewScale: fastifyResult.previewScale,
      previewPath: previewSrc,
      originalPath: fastifyResult.originalPath,
      aspectRatio: fastifyResult.aspectRatio,
      tags: {
        connect: tags?.map((t) => ({ id: t.id })),
      },
      fileExt: fastifyResult.finalExt,
      fileSize: fastifyResult.fileSize,
      previewSize: fastifyResult.previewSize, // will always be set, if preview was deleted, it will just be the same as fileSize.
      duration: fastifyResult.duration,
      hasAudio: fastifyResult.hasAudio
    },
  })

  return NextResponse.json({ success: true, postId, fileName: fastifyResult.fileName });
}
