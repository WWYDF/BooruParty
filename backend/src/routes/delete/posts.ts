import { FastifyPluginAsync } from "fastify";
import path from "path";
import fs from "fs/promises";
import { appLogger } from "../../plugins/logger";

const logger = appLogger('Delete Posts');

const mediaFolders = [
  "data/uploads/image",
  "data/uploads/video",
  "data/uploads/animated",
  "data/previews/image",
  "data/previews/animated",
  "data/previews/video",
  "data/thumbnails",
];

// Helper to decide if a given filename belongs to a post id in a folder
function fileBelongsToPost(file: string, idStr: string, folder: string): boolean {
  const isThumbnailFolder = folder.includes("thumbnails");

  if (isThumbnailFolder) {
    // Thumbnails: id_small.webp, id_med.webp, id_large.webp
    return (
      file === `${idStr}_small.webp` ||
      file === `${idStr}_med.webp` ||
      file === `${idStr}_large.webp`
    );
  }

  // Uploads & previews:
  // Uses same sketchy startsWith causing the problem before, ik
  // Second condition is if the length of the ID +1 slot is the . (for extension), then we're good.
  // So 21.webp, 3rd slot is the dot. So the length of 21 is 2 + 1 = 3. 3rd slot.
  if (file.startsWith(idStr) && file[idStr.length] === ".") { return true; };

  return false;
}

const postDeleteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post("/delete/posts", async function (req, reply) {
    const { postId, postIds } = (await req.body) as {
      postId?: number;
      postIds?: number[];
    };

    let idsToDelete: number[] = [];

    if (Array.isArray(postIds) && postIds.length > 0) {
      idsToDelete = postIds;
    } else if (typeof postId === "number") {
      idsToDelete = [postId];
    } else {
      return reply.code(400).send({ error: "Missing or invalid postId(s)" });
    }

    for (const id of idsToDelete) {
      const idStr = String(id);
      logger.info(`Attempting to delete post #${id}...`);

      for (const folder of mediaFolders) {
        try {
          const files = await fs.readdir(folder);

          const matches = files.filter((file) =>
            fileBelongsToPost(file, idStr, folder)
          );

          for (const file of matches) {
            const filePath = path.join(folder, file);
            try {
              logger.warn(`Deleting file: ${filePath}!`);
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