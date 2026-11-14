import path from "path";
import { FileType } from "../../../prisma/client";
import { fileTypeFromFile } from 'file-type';
import sharp from "sharp";
import fs from "fs";
import { MultipartFile } from "@fastify/multipart";
import { appLogger } from "@/core/plugins/logger";

const logger = appLogger('Posts/Receive');
export const tempDir = path.join(process.cwd(), 'data', 'temp');

// Supported formats for each category (type)
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/tiff'];
const ANIMATED_MIMES = ['image/gif', 'image/apng'];
const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo'];

export type DetectedFile = {
  type: FileType;
  mime: string;
  ext: string;
}

// Reads the file's magic bytes to work out what it really is. Returns null if unsupported format.
export async function detectFileType(filePath: string): Promise<DetectedFile | null> {
  const result = await fileTypeFromFile(filePath);
  if (!result) return null;
  const { mime, ext } = result;

  if (ANIMATED_MIMES.includes(mime)) return { type: 'ANIMATED', mime, ext };
  if (VIDEO_MIMES.includes(mime)) return { type: 'VIDEO', mime, ext };

  if (IMAGE_MIMES.includes(mime)) {
    // WebP can be either still or animated. Only sharp can tell by counting frames.
    if (mime === 'image/webp') {
      const { pages } = await sharp(filePath).metadata();
      if (pages && pages > 1) return { type: 'ANIMATED', mime, ext };
    }
    return { type: 'IMAGE', mime, ext }
  }
  return null;
}


// Deletes every temp file for this upload. Safe to call even if some don't exist.
export async function cleanupTemp(fileKey: string) {
  try {
    const entries = await fs.promises.readdir(tempDir);
    await Promise.all(
      entries
        .filter((name) => name.startsWith(fileKey))
        .map((name) => fs.promises.rm(path.join(tempDir, name), { force: true } ))
    );
  } catch (e) {
    logger.error(`Failed to clean up temp files for ${fileKey}`, e);
  }
}