import { AVATAR_SIZE } from "@/core/objects/limits";
import path from "path";
import sharp from "sharp";

// Absolute path of an avatar on disk
export function avatarFilePath(key: string): string {
  return path.join(process.cwd(), 'data', 'avatars', `${key}.webp`);
}

// Square-crops any image sharp can read into data/avatars/<key>.webp
// Writes straight to the final spot. Caller deletes it if anything fails after
export async function writeAvatar(sourcePath: string, key: string): Promise<string> {
  const dest = avatarFilePath(key);

  await sharp(sourcePath)
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
    .webp({ quality: 65 })
    .toFile(dest);
  
  return dest;
}