import { FastifyPluginAsync } from "fastify";
import { Prisma } from "../../../prisma/client";
import { prisma } from "@/core/plugins/prisma";
import { rolePermissionCheck } from "@/core/utilities/permissionCache";
import { HttpError } from "@/core/utilities/errors";
import { getViewer, isHiddenFrom, Viewer } from "@/core/utilities/viewer";
import { assertEmbedsAllowed, parseEmbeds, resolveEmbeddedPosts } from "@/components/posts/comments";
import { commentSelect } from "@/core/objects/selects/comments";
import { MAX_COMMENT_LENGTH, MAX_INT } from "@/core/objects/limits";
import { postVisibilitySelect } from "@/core/objects/selects/posts";

const commentParams = {
  type: 'object',
  required: ['commentId'],
  properties: { commentId: { type: 'integer', minimum: 1, maximum: MAX_INT } },
} as const;

const notFound = () => new HttpError(404, { error: 'Not found', hint: 'No comment with that id' });

// The comment plus what the checks need. A comment on a post you can't see doesn't exist for you.
async function loadComment(commentId: number, viewer: Viewer) {
  const comment = await prisma.postComment.findUnique({
    where: { id: commentId },
    select: { authorId: true, content: true, post: { select: postVisibilitySelect } },
  });
  if (!comment || isHiddenFrom(viewer, comment.post)) throw notFound();
  return comment;
}

// "others" covers your own comments too; "own" only covers yours
function assertCanManage(roleId: string, isOwner: boolean, action: 'edit' | 'delete') {
  const allowed = rolePermissionCheck(roleId, `comment.${action}.others`)
    || (isOwner && rolePermissionCheck(roleId, `comment.${action}.own`));

  if (!allowed) {
    throw new HttpError(403, { error: 'Forbidden', hint: `Missing permission: comment.${action}.${isOwner ? 'own' : 'others'}` });
  }
}

const manageComments: FastifyPluginAsync = async (fastify) => {

  fastify.patch('/:commentId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: commentParams,
      body: {
        type: 'object',
        required: ['content'],
        additionalProperties: false,
        properties: { content: { type: 'string', minLength: 1, maxLength: MAX_COMMENT_LENGTH } },
      },
    },
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { commentId } = req.params as { commentId: number };
    const content = (req.body as { content: string }).content.trim();
    if (!content) return reply.status(400).send({ error: 'Empty comment', hint: 'Delete it instead' });

    const viewer = await getViewer(req);
    const comment = await loadComment(commentId, viewer);
    assertCanManage(req.user.roleId, comment.authorId === req.user.sub, 'edit');

    const embeds = parseEmbeds(content);
    assertEmbedsAllowed(embeds, req.user.roleId, parseEmbeds(comment.content));

    try {
      // Unchanged text isn't an edit, so don't mark it "edited"
      const updated = await prisma.postComment.update({
        where: { id: commentId },
        data: content === comment.content ? {} : { content, editedAt: new Date() },
        select: commentSelect,
      });

      return reply.status(200).send({
        comment: { ...updated, embeds },
        embeddedPosts: await resolveEmbeddedPosts(embeds.postIds, viewer),
      });
    } catch (e) {
      // Deleted between the checks and the update
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw notFound();
      throw e;
    }
  });

  fastify.delete('/:commentId', {
    onRequest: [fastify.authenticate],
    schema: { params: commentParams },
  }, async (req, reply) => {
    const { commentId } = req.params as { commentId: number };

    const viewer = await getViewer(req);
    const comment = await loadComment(commentId, viewer);
    assertCanManage(req.user.roleId, comment.authorId === req.user.sub, 'delete');

    // If someone else deleted it a moment ago, that's fine; it's gone either way
    await prisma.postComment.deleteMany({ where: { id: commentId } });
    return reply.status(204).send();
  });
};

export default manageComments;
