import sharp from "sharp";
import { VideoInfo } from "./video";
import path from "path";
import fs from "fs";
import { DetectedFile, tempDir } from "./receive";
import { PreviewResult } from "./previews";
import { THUMBNAIL_SIZES } from "./thumbnails";


// Width / Height as the file is displayed
export async function getAspectRatio(filePath: string, videoInfo: VideoInfo | null): Promise<number> {
  if (videoInfo) return videoInfo.width / videoInfo.height;

  const meta = await sharp(filePath).metadata();
  const width = meta.width!;
  const height = meta.pageHeight ?? meta.height!; // for animations: one frame's height
  const sideways = (meta.orientation ?? 1) >= 5;  // EXIF orientations 5-8 rotate 90 degrees
  return sideways ? height/width : width/height;
}

// "/data/uploads/image/<key>.png" style path, as stored in database
function storedPath(...parts: string[]): string {
  return '/' + path.posix.join('data', ...parts);
}

async function moveTo(from: string, stored: string, moved: string[]) {
  const dest = path.join(process.cwd(), stored);
  await fs.promises.rename(from, dest);
  moved.push(dest);
}

// Moves the original, preview, and thumbnails out of temp and into their final folders.
// Every successfully moved file is added to "moved", so the caller can undo it on failure.
export async function moveIntoPlace(
  fileKey: string,
  tempPath: string,
  detected: DetectedFile,
  preview: PreviewResult | null,
  moved: string[]
): Promise<{ originalPath: string; previewPath: string | null }> {
  const typeDir = detected.type.toLowerCase();

  const originalPath = storedPath('uploads', typeDir, `${fileKey}.${detected.ext}`);
  await moveTo(tempPath, originalPath, moved);

  let previewPath: string | null = null;
  if (preview) {
    previewPath = storedPath('previews', typeDir, `${fileKey}.${preview.ext}`);
    await moveTo(preview.path, previewPath, moved);
  }

  for (const label of Object.keys(THUMBNAIL_SIZES)) {
    await moveTo(
      path.join(tempDir, `${fileKey}_${label}.webp`),
      storedPath('thumbnails', `${fileKey}_${label}.webp`),
      moved,
    );
  }

  return { originalPath, previewPath };
}

// Deletes files that were already moved into place (used when creating the post fails)
export async function discardFiles(paths: string[]) {
  await Promise.all(paths.map((p) => fs.promises.rm(p, { force: true })));
}

// Every file on disk that belongs to a post (original, preview, thumbnails), as absolute paths
export function postFilePaths(post: { fileKey: string, originalPath: string, previewPath: string | null }): string[] {
  const stored = [post.originalPath];
  if (post.previewPath) stored.push(post.previewPath);

  for (const label of Object.keys(THUMBNAIL_SIZES)) {
    stored.push(storedPath('thumbnails', `${post.fileKey}_${label}.webp`));
  }

  return stored.map((p) => path.join(process.cwd(), p));
}