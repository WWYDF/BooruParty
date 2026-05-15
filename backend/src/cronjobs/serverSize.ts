import fs from "fs";
import path from "path";
import { appLogger } from "../plugins/logger";
import { LapisData, writeLapisDb } from "../utils/lapisDb";

const logger = appLogger('Cron');
const basePath = path.join(process.cwd(), 'data/');

export async function updateSpaceUsed() {
  logger.info('Updating space used...');

  let totalSize = 0;

  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const stats = fs.statSync(fullPath);
        totalSize += stats.size;
      }
    }
  };

  try {
    walk(basePath);
    const totalMB = +(totalSize / (1024 * 1024)).toFixed(2); // Convert to MB and round
    await writeLapisDb<LapisData>({ megaBytesUsed: totalMB });
    logger.info(`Updated! (${totalMB} MB)`);
    return;

  } catch (err) {
    logger.error('Failed to calculate storage usage:', err);
    return;
  }
}