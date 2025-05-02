import { FastifyPluginAsync } from "fastify";
import path from "path";
import fs from "fs/promises";

const postDeleteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post("/delete/posts", async function (req, reply) {
    const { postId, postIds } = await req.body as { postId?: number; postIds?: number[] };

    let idsToDelete: number[] = [];

    if (Array.isArray(postIds)) {
      idsToDelete = postIds;
    } else if (typeof postId === "number") {
      idsToDelete = [postId];
    } else {
      return reply.code(400).send({ error: "Missing or invalid postId(s)" });
    }

    for (const id of idsToDelete) {
      const idStr = `${id}`;
    
      // Folders to scan for files by ID (excluding thumbnails)
      const mediaFolders = [
        "data/uploads/image",
        "data/uploads/video",
        "data/uploads/animated",
        "data/previews/image",
        "data/previews/animated",
        "data/thumbnails",
      ];
    
      for (const folder of mediaFolders) {
        try {
          const files = await fs.readdir(folder);
          const matches = files.filter((file) => file.startsWith(idStr));
    
          for (const file of matches) {
            const filePath = path.join(folder, file);
            try {
              await fs.unlink(filePath);
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
                fastify.log.warn(`Failed to delete ${filePath}: ${err}`);
              }
            }
          }
        } catch (err) {
          fastify.log.warn(`Could not read ${folder}: ${err}`);
        }
      }
    }

    return reply.send({ success: true, deleted: idsToDelete.length });
  });
};

export default postDeleteRoute;