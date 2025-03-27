import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';

export async function saveFile(
  stream: NodeJS.ReadableStream,
  originalName: string,
  targetDir: string
): Promise<string> {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  const filename = `${base}-${Date.now()}${ext}`;
  const fullPath = path.join(targetDir, filename);

  await pipeline(stream, fs.createWriteStream(fullPath));

  return filename;
}
