import { FastifyPluginAsync } from "fastify";
import { AutoTaggerMode, Safety } from "../../../prisma/client";
import { prisma } from "@/core/plugins/prisma";
import { requirePermission } from "@/core/utilities/permissionCache";
import { getServerAddons, loadServerAddons } from "@/core/utilities/addonsCache";

const addons: FastifyPluginAsync = async (fastify) => {

  fastify.patch('/addons', {
    onRequest: [fastify.authenticate, requirePermission('dashboard.addons')],
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          enableAutoTagger: { type: 'boolean' },
          autoTaggerUrl: { type: ['string', 'null'], format: 'uri' },
          autoTaggerMode: {
            type: 'array',
            items: { type: 'string', enum: Object.values(AutoTaggerMode) },
            uniqueItems: true
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

    await prisma.addons.update({ where: { id: 1 }, data: body });
    await loadServerAddons(); // refresh the cache so the change applies for the next request

    return reply.status(200).send(getServerAddons());
  });
}

export default addons;