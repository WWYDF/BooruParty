import { FastifyPluginAsync } from "fastify"
import { Prisma, Safety } from "../../../prisma/client"
import { isHttpUrl, MAX_NOTES_LENGTH, MAX_SOURCE_LENGTH, MAX_SOURCES, MAX_TAGS } from "@/components/uploads/fields";
import { prisma } from "@/core/plugins/prisma";
import { rolePermissionCheck } from "@/core/utilities/permissionCache";
import { HttpError } from "@/core/utilities/errors";

type EditBody = {
  safety?: Safety,
  sources?: string[],
  notes?: string | null,
  tags?: string[],
}

const managePosts: FastifyPluginAsync = async (fastify) => {
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1 } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          safety: { type: 'string', enum: Object.values(Safety) },
          sources: { type: 'array', maxItems: MAX_SOURCES, items: { type: 'string', maxLength: MAX_SOURCE_LENGTH } },
          notes: { type: ['string', 'null'], maxLength: MAX_NOTES_LENGTH },
          tags: { type: 'array', maxItems: MAX_TAGS, items: { type: 'string' } },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const body = req.body as EditBody;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, uploaderId: true }
    });
    if (!post) { return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' }); };

    // edit.others covers your own posts too, edit.own only covers yours
    const isOwner = post.uploaderId === req.user.sub;
    const allowed = rolePermissionCheck(req.user.roleId, 'posts.edit.others')
      || (isOwner && rolePermissionCheck(req.user.roleId, 'posts.edit.own'));

    if (!allowed) {
      return reply.status(403).send({
        error: 'Forbidden',
        hint: `Missing permission ${isOwner ? 'posts.edit.own' : 'posts.edit.others'}`
      });
    }

    // Continue with edits now that perms have cleared

    // Only copy fields that were sent (undefined = leave untouched)
    const data: Prisma.PostUpdateManyMutationInput = { updatedAt: new Date() };

    if (body.safety !== undefined) data.safety = body.safety;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

    if (body.sources !== undefined) {
      // trum, drop blank rows from the editor, de-dupe
      const sources = [...new Set(body.sources.map((s) => s.trim()).filter(Boolean))];
      const bad = sources.find((s) => !isHttpUrl(s));
      if (bad !== undefined) { return reply.status(400).send({ error: 'Invalid fields', hint: `Invalid source URL: ${bad.slice(0, 100)}` }) };
      data.sources = sources;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // updateMany instead of update (returns a count rather than throwing if post vanished)
        const { count } = await tx.post.updateMany({ where: { id }, data });
        if (count === 0) throw new HttpError(404, { error: 'Not found', hint: 'No post with that id' });

        // Step 3
      })
    } catch (e) {
      if (e instanceof HttpError) return reply.status(e.status).send(e.body);
      throw e;
    }

    return reply.status(204).send();
  }
)};

export default managePosts;