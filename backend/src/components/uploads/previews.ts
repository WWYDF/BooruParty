import path from "path";
import { DetectedFile, tempDir } from "./receive";
import sharp from "sharp";
import fs from "fs";


const PREVIEW_MAX_WIDTH = 1280;
export type PreviewResult = { path: string; ext: string; size: number };

// Writes <fileKey>_preview.<ext> to temp. Returns null when the post shouldn't have a preview.
export async function generatePreview(filePath: string, detected: DetectedFile, fileKey: string): Promise<PreviewResult | null> {
  const previewPath = path.join(tempDir, `${fileKey}_preview.webp`);

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

  else {
    return null; // ill do video later since its a whole different beast
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

  return { path: previewPath, ext: 'webp', size: preview.size }
}