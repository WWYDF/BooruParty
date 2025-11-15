import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import { appLogger } from '../plugins/logger';

const logger = appLogger('Stats');

const statsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stats', async (req, reply) => {
    const basePath = path.join(process.cwd(), 'data/');
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

      return reply.send({ totalMB }); // Send total in megabytes
    } catch (err) {
      logger.error('Failed to calculate storage usage:', err);
      return reply.code(500).send({ error: 'Failed to calculate storage usage' });
    }
  });
};


export default statsRoute;