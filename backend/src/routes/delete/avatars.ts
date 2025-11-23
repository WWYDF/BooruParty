import { FastifyPluginAsync } from "fastify";
import path from "path";
import fs from "fs/promises";
import { appLogger } from "../../plugins/logger";

const logger = appLogger('Delete Avatars');

const avatarDeleteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.delete("/delete/avatar/:userId", async (req, reply) => {
    const userId = (req.params as { userId: string }).userId;
    const avatarDir = path.join(process.cwd(), 'data/avatars');

    try {
      const files = await fs.readdir(avatarDir);
      const matching = files.filter((f) => f.startsWith(`${userId}_`) && f.endsWith(".webp"));

      await Promise.all(
        matching.map((filename) =>
          fs.unlink(path.join(avatarDir, filename)).catch((err) => {
            if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
              logger.error(`Failed to delete avatar: ${filename}: ${err}`);
            }
          })
        )
      );

      return reply.send({ success: true, deleted: matching.length });
    } catch (err) {
      logger.error("Failed to delete avatars:", err);
      return reply.status(500).send({ error: "Failed to delete avatars" });
    }
  });
};

export default avatarDeleteRoute;