import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tempDir } from "./receive";
import path from "node:path";
import { FileType } from "../../../prisma/client";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

export const THUMBNAIL_SIZES = { small: 200, med: 400, large: 800 } as const;
export type ThumbnailSize = keyof typeof THUMBNAIL_SIZES;

const FRAME_FILTERS = 'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709,thumbnail';

// Grabs a representative, full-resolution frame from a video into a temp png
async function extractFrame(filePath: string, fileKey: string): Promise<string> {
  const framePath = path.join(tempDir, `${fileKey}_frame.png`);
  await execFileAsync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', filePath,
    '-vf', FRAME_FILTERS,
    '-frames:v', '1',
    framePath,
  ]);
  return framePath;
}

// Writes <fileKey>_small.webp, _med.webp, and _large.webp into the temp folder
export async function generateThumbnails(filePath: string, type: FileType, fileKey: string) {
  const source = type === 'VIDEO' ? await extractFrame(filePath, fileKey) : filePath;
  const base = sharp(source).rotate(); // apply EXIF orientation

  await Promise.all(
    Object.entries(THUMBNAIL_SIZES).map(([label, width]) =>
    base
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 50 })
      .toFile(path.join(tempDir, `${fileKey}_${label}.webp`)),
    ),
  );
}