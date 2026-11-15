import { FastifyPluginAsync } from "fastify";
import { getServerStats } from "@/components/cronjobs/serverSide";

const stats: FastifyPluginAsync = async (fastify) => {

  // Return cached stats
  fastify.get('/stats', async (req, reply) => {
    return reply.status(200).send(getServerStats());
  });
}

export default stats;
