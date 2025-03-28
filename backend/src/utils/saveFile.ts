import { pipeline } from 'stream/promises';
import fs from 'fs';

export async function saveFile(
  stream: NodeJS.ReadableStream,
  fullPath: string
): Promise<void> {
  await pipeline(stream, fs.createWriteStream(fullPath)); // Overwrites existing file
}
