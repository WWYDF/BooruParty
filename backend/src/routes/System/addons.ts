import { FastifyPluginAsync } from "fastify";
import { AutoTaggerMode } from "../../../prisma/client";
import { prisma } from "@/core/plugins/prisma";
import { requirePermission, rolePermissionCheck } from "@/core/utilities/permissionCache";
import { getServerAddons, loadServerAddons } from "@/core/utilities/addonsCache";

const addons: FastifyPluginAsync = async (fastify) => {

  fastify.get('/addons', {
    onRequest: [fastify.identify],
  }, async (req, reply) => {
    const { enableAutoTagger, autoTaggerUrl, autoTaggerMode } = getServerAddons();
    const canManage = !!req.user && rolePermissionCheck(req.user.roleId, 'dashboard.addons');

    return reply.status(200).send({
      enableAutoTagger,
      autoTaggerMode,
      ...(canManage && { autoTaggerUrl }), // hide URL from non-admins lol
    });
  });

  fastify.patch('/addons', {
    onRequest: [fastify.authenticate, requirePermission('dashboard.addons')],
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          enableAutoTagger: { type: 'boolean' },
          autoTaggerUrl: { type: ['string', 'null'], format: 'uri', pattern: '^https?://' },
          autoTaggerMode: {
            type: 'array',
            items: { type: 'string', enum: Object.values(AutoTaggerMode) },
            uniqueItems: true,
            minItems: 1,
          },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as {
      enableAutoTagger?: boolean,
      autoTaggerUrl?: string | null,
      autoTaggerMode?: AutoTaggerMode[],
    };

    const next = { ...getServerAddons(), ...body };
    if (next.enableAutoTagger && !next.autoTaggerUrl) {
      return reply.status(400).send({ error: 'Invalid addons', hint: 'Set autoTaggerUrl before enabling the AutoTagger' });
    }

    await prisma.addons.update({ where: { id: 1 }, data: body });
    await loadServerAddons(); // refresh the cache so the change applies for the next request

    return reply.status(200).send(getServerAddons());
  });
}

export default addons;