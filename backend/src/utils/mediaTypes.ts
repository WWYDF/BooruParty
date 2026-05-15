import busboy from "busboy";
import { Readable } from "stream";
import sharp from "sharp";

export const ALLOWED_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff',
  'gif', 'apng',
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'quicktime'
];

export type FileTypes = 'image' | 'animated' | 'video';

export async function getMediaType(file: Readable, info: busboy.FileInfo): Promise<{ type: FileTypes | null, buffer: Buffer }> {
  const mime = info.mimeType.toLowerCase();

  // For non-WebP, we need to buffer anyway
  const buffer = await streamToBuffer(file);

  // Animated images (always animated)
  if (mime === 'image/gif' || mime === 'image/apng') {
    return { type: 'animated', buffer };
  }

  // WebP - check if animated
  if (mime === 'image/webp') {
    if (await isAnimatedWebP(buffer)) {
      return { type: 'animated', buffer };
    }
    return { type: 'image', buffer };
  }

  // Static images
  if (mime.startsWith('image/')) {
    return { type: 'image', buffer };
  }

  // Videos
  if (mime.startsWith('video/')) {
    return { type: 'video', buffer };
  }

  return { type: null, buffer };
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function isAnimatedWebP(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return metadata.pages !== undefined && metadata.pages > 1;
  } catch (error) {
    return false;
  }
}