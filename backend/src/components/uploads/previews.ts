import path from "path";
import { DetectedFile, tempDir } from "./receive";
import sharp from "sharp";
import fs from "fs";
import { getEncoder } from "./encoders";
import { encodeVideoPreview, VideoInfo } from "./video";

const PREVIEW_MAX_WIDTH = 1280;
export type PreviewResult = { path: string; ext: string; size: number };

// Writes <fileKey>_preview.<ext> to temp. Returns null when the post shouldn't have a preview.
export async function generatePreview(filePath: string, detected: DetectedFile, fileKey: string, videoInfo: VideoInfo | null): Promise<PreviewResult | null> {
  let ext = 'webp';
  let previewPath = path.join(tempDir, `${fileKey}_preview.${ext}`);

  if (detected.type === 'IMAGE') {
    await sharp(filePath)
      .rotate()
      .resize({ width: PREVIEW_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(previewPath);
  }

  else if (detected.type === 'ANIMATED') {
    // sharp can't decode APNG animation, don't generate preview
    if (detected.mime === 'image/apng') return null;

    await sharp(filePath, { animated: true, limitInputPixels: false })
      .resize({ width: PREVIEW_MAX_WIDTH, withoutEnlargement: true })
      .webp({
        quality: Number(process.env.ANIMATION_QUALITY ?? 80),
        effort: Number(process.env.ANIMATION_COMPRESSION ?? 4),
        loop: 0,
      })
      .toFile(previewPath);
  }

  else if (detected.type === 'VIDEO') {
    const enc = getEncoder();
    if (!enc || !videoInfo) return null; // previews disabled, serve original instead

    ext = enc.container;
    previewPath = path.join(tempDir, `${fileKey}_preview.${ext}`);
    await encodeVideoPreview(filePath, previewPath, enc, videoInfo.hasAudio);
  }

  // A preview is only worth keeping if it's actually smaller than the original
  const [original, preview] = await Promise.all([
    fs.promises.stat(filePath),
    fs.promises.stat(previewPath),
  ]);

  if (preview.size >= original.size) {
    await fs.promises.rm(previewPath, { force: true });
    return null;
  }

  return { path: previewPath, ext, size: preview.size }
}