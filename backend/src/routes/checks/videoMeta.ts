import { FastifyPluginAsync } from "fastify";
import path from "path";
import { runFFprobe } from "../../utils/Uploads/Animated/ffInterface";

type IncomingItem = {
  id: number,
  originalPath: string,
}

type CheckBody = {
  items: IncomingItem[]
}

type VideoMetaResult = {
  id: number,
  duration: number | null,
  hasAudio: boolean | null,
}

const FFPROBE_HAS_AUDIO = [
  '-v', 'error',
  '-select_streams', 'a:0',
  '-show_entries', 'stream=codec_type',
  '-of', 'default=noprint_wrappers=1:nokey=1',
];

const FFPROBE_DURATION = [
  '-v', 'error',
  '-show_entries', 'format=duration',
  '-of', 'default=noprint_wrappers=1:nokey=1',
];

const videoMeta: FastifyPluginAsync = async (fastify) => {
  fastify.post<{Body: CheckBody; Reply: VideoMetaResult[];}>('/videoMeta', { preHandler: fastify.verifyIp }, async function (req, reply) {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) { return reply.code(400).send({ error: 'No items provided' } as any) };

    const results: VideoMetaResult[] = await Promise.all(
      items.map(async ({ id, originalPath }) => {
        try {
          const realPath = path.join(process.cwd(), originalPath);
          const audioResult = await runFFprobe([...FFPROBE_HAS_AUDIO, realPath], 'ffprobe:audio-check');
          const hasAudio = audioResult.trim() === 'audio';

          const durationResult = await runFFprobe([...FFPROBE_DURATION, realPath], 'ffprobe:duration');
          const duration = parseFloat(durationResult.trim());

          return { id, hasAudio: hasAudio, duration };
        } catch {
          return { id, hasAudio: null, duration: null };
        }
      })
    );

    return reply.send(results);

  });
};

export default videoMeta;