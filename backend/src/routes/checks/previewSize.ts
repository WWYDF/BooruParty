import { FastifyPluginAsync } from "fastify";
import fs from "fs/promises";
import path from "path";

type PreviewItem = {
  id: number,
  previewPath: string,
}

type PreviewCheckBody = {
  items: PreviewItem[]
}

type PreviewSizeResult = {
  id: number,
  size: number | null,
}

const previewSize: FastifyPluginAsync = async (fastify) => {
  fastify.post<{Body: PreviewCheckBody; Reply: PreviewSizeResult[];}>('/previews', { preHandler: fastify.verifyIp }, async function (req, reply) {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) { return reply.code(400).send({ error: 'No items provided' } as any) };

    const results: PreviewSizeResult[] = await Promise.all(
      items.map(async ({ id, previewPath }) => {
        try {
          const realPath = path.join(process.cwd(), previewPath);
          const stats = await fs.stat(realPath);
          return { id, size: stats.size };
        } catch {
          return { id, size: null };
        }
      })
    );

    return reply.send(results);

  });
};

export default previewSize;