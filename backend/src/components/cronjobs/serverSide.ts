import fs from "fs";
import path from "path";
import { appLogger } from "@/core/plugins/logger";
import { prisma } from "@/core/plugins/prisma";

const logger = appLogger('Cron');
const basePath = path.join(process.cwd(), 'data/');

export interface ServerStats {
  megaBytesUsed: number;
  postCount: number;
  updatedAt: Date | null;
}

// Module-level = one shared instance for the whole process
const serverStats: ServerStats = {
  megaBytesUsed: 0,
  postCount: 0,
  updatedAt: null,
};

export const getServerStats = (): Readonly<ServerStats> => serverStats;

export async function updateServerStats() {
  logger.info('[~] Updating server stats...');

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
    serverStats.megaBytesUsed = +(totalSize / (1024 * 1024)).toFixed(2); // Convert to MB and round
    serverStats.postCount = await prisma.post.count();
    serverStats.updatedAt = new Date();
    logger.info(`[+] Updated Server Size. (${serverStats.megaBytesUsed} MB, ${serverStats.postCount} posts)`);
  } catch (err) {
    logger.error('Failed to update server stats:', err);
  }
}
