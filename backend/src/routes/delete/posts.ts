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
      const mediaPaths = [
        path.join("data/uploads/image", `${id}.webp`),
        path.join("data/uploads/video", `${id}.mp4`),
        path.join("data/uploads/animated", `${id}.gif`),
        path.join("data/previews/image", `${id}.webp`),
        path.join("data/previews/animated", `${id}.gif`),
        ...["small", "med", "large"].map(size =>
          path.join("data/thumbnails", `${id}_${size}.webp`)
        ),
      ];

      for (const filePath of mediaPaths) {
        try {
          await fs.unlink(filePath);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            fastify.log.warn(`Failed to delete ${filePath}: ${err}`);
          }
        }
      }
    }

    return reply.send({ success: true, deleted: idsToDelete.length });
  });
};

export default postDeleteRoute;