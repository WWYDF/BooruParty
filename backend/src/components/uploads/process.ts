import { HttpError } from "@/core/utilities/errors";
import { FileType } from "../../../prisma/client"
import { detectFileType, tempDir } from "./receive"
import { PermissionName } from "@/core/objects/permissions";
import { rolePermissionCheck } from "@/core/utilities/permissionCache";
import { computePHash, findDuplicate } from "./dedupe";
import { generateThumbnails } from "./thumbnails";
import { convertToAnimatedWebp, probeVideo, shouldConvertToAnimation } from "./video";
import { generatePreview } from "./previews";
import { getAspectRatio, moveIntoPlace } from "./finalize";
import fs from "fs";
import path from "path";

// Field names match Post's columns, so the result can be spread straight into create/update data functions
export type ProcessedUpload = {
  type: FileType,
  originalPath: string,
  previewPath: string | null,
  fileSize: bigint,
  previewSize: bigint | null,
  aspectRatio: number,
  duration: number | null,
  hasAudio: boolean,
  pHash: string,
  dupeBypass: boolean,
}

type ProcessOptions = {
  roleId: string,
  skipDupes: boolean,
  ignoreDupeOf?: number, // post being replaced, so it isn't its own duplicate
  moved: string[],
}

// Takes a file already streamed to temp and turns it into a finished set of post files.
// Throws HttpError for anything the client did wrong (type, permissions, duplicate, etc.)
export async function processUpload(tempPath: string, fileKey: string, opts: ProcessOptions): Promise<ProcessedUpload> {

  // 1. Work out what it really is
  const detected = await detectFileType(tempPath);
  if (!detected) throw new HttpError(415, { error: 'Unsupported file type' });
  const videoInfo = detected.type === 'VIDEO' ? await probeVideo(tempPath) : null;

  // 2. Short, Silent videos are converted to animations (then started over)
  if (videoInfo && shouldConvertToAnimation(videoInfo)) {
    const webpPath = path.join(tempDir, `${fileKey}_anim.webp`);
    await convertToAnimatedWebp(tempPath, webpPath);
    return processUpload(webpPath, fileKey, opts);
  }

  // 3. Is this user allowed to upload this kind of file?
  const typePerm = `upload.type.${detected.type.toLowerCase()}` as PermissionName;
  if (!rolePermissionCheck(opts.roleId, typePerm)) {
    throw new HttpError(403, { error: 'Forbidden', hint: `Missing permission: ${typePerm}` })
  }

  // 4. Duplicate check
  const pHash = await computePHash(tempPath, detected.type);
  const dupeBypass = opts.skipDupes && rolePermissionCheck(opts.roleId, 'posts.create.dupes');
  if (!dupeBypass) {
    const duplicateOf = await findDuplicate(pHash, opts.ignoreDupeOf);
    if (duplicateOf !== null) {
      throw new HttpError(409, { error: 'Duplicate', hint: 'This file already exists', duplicateOf });
    }
  }

  // 5. Thumbnails
  await generateThumbnails(tempPath, detected.type, fileKey);

  // 6. Preview
  const preview = await generatePreview(tempPath, detected, fileKey, videoInfo);

  // 7. Final measurements (BEFORE moving: tempPath doesn't exist afterwards)
  const aspectRatio = await getAspectRatio(tempPath, videoInfo);
  const { size } = await fs.promises.stat(tempPath);

  // 8. Move everything into place
  const { originalPath, previewPath } = await moveIntoPlace(fileKey, tempPath, detected, preview, opts.moved);

  return {
    type: detected.type,
    originalPath,
    previewPath,
    fileSize: BigInt(size),
    previewSize: preview ? BigInt(preview.size) : null,
    aspectRatio,
    duration: videoInfo?.duration ?? null,
    hasAudio: videoInfo?.hasAudio ?? false,
    pHash,
    dupeBypass,
  };
}