import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { FileType } from "../../../prisma/client";
import getPHash from 'sharp-phash';
import { prisma } from "@/core/plugins/prisma";

const execFileAsync = promisify(execFile);
const DUPE_THRESHOLD = 5; // max differing bits to count as duplicate (same as v0.14)

const FRAME_FILTERS = 'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709,thumbnail,scale=320:-1,format=yuvj420p';

async function extractVideoFrame(filePath: string): Promise<Buffer> {
  const { stdout } = await execFileAsync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-i', filePath,
    '-frames:v', '1',
    '-vf', FRAME_FILTERS,
    '-vcodec', 'mjpeg', '-q:v', '2',
    '-f', 'image2', 'pipe:1',
  ], { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 });
  return stdout;
}

export async function computePHash(filePath: string, type: FileType): Promise<string> {
  if (type === 'VIDEO') { return getPHash(await extractVideoFrame(filePath)) };
  return getPHash(filePath);
}

// Returns the id of the closest existing post within the threshold, or null
export async function findDuplicate(pHash: string, excludeId?: number): Promise<number | null> {
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM "Post"
    WHERE length("pHash") = 64
      AND id <> ${excludeId ?? 0}
      AND bit_count("pHash"::bit(64) # ${pHash}::bit(64)) <= ${DUPE_THRESHOLD}
    ORDER BY bit_count("pHash"::bit(64) # ${pHash}::bit(64)) ASC
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}