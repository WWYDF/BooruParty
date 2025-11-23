import { FastifyPluginAsync } from "fastify";
import { appLogger } from "../../plugins/logger";
import { deletePostData } from "../../utils/cleanupPost";

const logger = appLogger('Delete Posts');

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
      await deletePostData(String(id));
    }

    return reply.send({ success: true, deleted: idsToDelete.length });
  });
};

export default postDeleteRoute;