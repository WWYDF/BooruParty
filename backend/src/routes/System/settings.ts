import { FastifyPluginAsync } from "fastify";
import { Safety } from "../../../prisma/client";
import { prisma } from "@/core/plugins/prisma";
import { requirePermission } from "@/core/utilities/permissionCache";
import { getServerSettings, loadServerSettings } from "@/core/utilities/settingsCache";

const settings: FastifyPluginAsync = async (fastify) => {

  // The frontend needs these before anyone logs in (e.g. show the feed or a login wall)
  fastify.get('/settings', async (req, reply) => {
    return reply.status(200).send(getServerSettings());
  });

  fastify.patch('/settings', {
    onRequest: [fastify.authenticate, requirePermission('dashboard.settings')],
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          guestAccess: { type: 'boolean' },
          guestSafety: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: { type: 'string', enum: Object.values(Safety) },
          },
          convertShortVids: { type: 'boolean' },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as {
      guestAccess?: boolean,
      guestSafety?: Safety[],
      convertShortVids?: boolean,
    };

    await prisma.serverSettings.update({ where: { id: 1 }, data: body });
    await loadServerSettings(); // refresh the cache so the change applies for the next request

    return reply.status(200).send(getServerSettings());
  });
}

export default settings;