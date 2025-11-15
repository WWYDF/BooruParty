import { FastifyPluginAsync } from 'fastify';
import fs from 'fs/promises';
import path from 'path';

const integrityCheck: FastifyPluginAsync = async (fastify) => {
  fastify.post('/checks/integrity', async function (req, reply) {
    let ids = req.body as unknown;

    // If body somehow comes in as string, try to parse
    if (typeof ids === 'string') {
      try {
        ids = JSON.parse(ids);
      } catch {
        return reply.code(400).send({ error: 'Malformed JSON body' });
      }
    }

    if (!Array.isArray(ids)) {
      console.log('[IntegrityCheck] Bad body:', ids);
      return reply.code(400).send({
        error: 'Body must be string[] of IDs',
      });
    }

    const idStrings = ids.map((id) => String(id));
    const uploadsRoot = path.join(process.cwd(), 'data', 'uploads');
    const subdirs = ['image', 'video', 'other'] as const;

    // Read all subfolders once
    const dirEntries = await Promise.all(
      subdirs.map(async (dir) => {
        const fullPath = path.join(uploadsRoot, dir);
        try {
          const files = await fs.readdir(fullPath);
          return { dir, files };
        } catch (err: any) {
          // If a folder doesn't exist, just treat as empty
          if (err?.code === 'ENOENT') {
            return { dir, files: [] as string[] };
          }
          throw err;
        }
      })
    );

    const missing: string[] = [];

    // For each ID, see if ANY subdir has <id>.<ext>
    for (const idStr of idStrings) {
      const foundInAny = dirEntries.some(({ files }) =>
        files.some(
          (file) =>
            file.startsWith(idStr) && file.charAt(idStr.length) === '.'
        )
      );

      if (!foundInAny) {
        missing.push(idStr);
      }
    }

    const totalChecked = idStrings.length;
    const totalMissing = missing.length;
    const percMissing = totalChecked === 0 ? 0 : (totalMissing / totalChecked) * 100;

    return reply.send({
      missing,
      totalChecked,
      totalMissing,
      percMissing,
    });
  });
};

export default integrityCheck;
