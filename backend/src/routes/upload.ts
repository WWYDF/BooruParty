// I hate files that are just one long function of if/elses,
// but it's imperative that we do all this linearly to prevent data loss.
// It's ugly but it works.

import fs from "fs";
import path from "path";
import Busboy from "busboy";
import { FastifyPluginAsync } from "fastify"
import { preProcessImage, preProcessVideo } from "../utils/Uploads/preProcessing";
import { SubFileUpload } from "../types/uploadTypes";
import { processPreviews } from "../utils/Uploads/previewProcessing";
import { generateThumbnails } from "../utils/Uploads/generateThumbnails";
import { getAspectRatio } from "../utils/Uploads/aspectRatio";
import { appLogger } from "../plugins/logger";
import { getMediaType } from "../utils/mediaTypes";

const logger = appLogger('Upload');

const uploadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/upload', { preHandler: fastify.verifySecret }, async (req, reply) => {
    return new Promise<void>((resolve, reject) => {
      let postId: string;
      let filePath = '';
      let convertVideos = process.env.FORCE_CONVERT_SHORT_VIDEOS == 'true' ? true : false;
      let subFile: SubFileUpload;

      const busboy = Busboy({ headers: req.headers });
      logger.debug('Received file!');
      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'postId' && /^\d+$/.test(value)) {
          postId = value;
        }
      });

      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'convert' && typeof value === 'boolean') {
          convertVideos = value;
        }
      });

      busboy.on('file', async (fieldname, file, info) => {
        try {
          const { filename } = info;
          if (!postId) { return reply.code(400).send({ error: 'Missing postId' }); };
          logger.debug(`Received postId! (${postId})`);

          const ext = path.extname(filename);
          const { type, buffer } = await getMediaType(file, info);
          logger.debug(`File looks like a(n) ${type}...`);
          if (!type) { return reply.code(415).send({ error: 'File type not allowed' }); };
          
          filePath = path.join(process.cwd(), '/data/uploads', type, `${postId}${ext}`);
          logger.debug(`Entire file has been received and saved to a buffer.`);

          // Build skeleton before pre-processing
          subFile = {
            postId,
            ogExt: ext.replace(/^\./, ""),
            type,
            ogPath: filePath,
            buffer,
            hasAudio: false,
          }

          logger.debug(`Starting Pre-Processing for ${type}!`);
          switch (type) {
            case 'image':
              subFile = await preProcessImage(subFile);
              break;
            case 'video':
              subFile = await preProcessVideo(subFile, convertVideos);
              break;
            default:
              await fs.promises.writeFile(filePath, buffer);
          };

          logger.debug(`SubFile Generated for ${subFile.postId}!`);

          const previewData = await processPreviews(subFile); logger.debug(`Saved Preview!`);
          if (!previewData || previewData === null) { return reply.code(500).send({ error: 'Failed to process upload, check console for details.' }); }
          await generateThumbnails(subFile); logger.debug(`Saved Thumbnails!`);
          const ratio = await getAspectRatio(subFile); logger.debug(`Saved Aspect Ratio!`);
          const finalStats = fs.statSync(subFile.ogPath);

          const previewPath = previewData.previewScale == 100 ? null : `/data/previews/${subFile.type}/${subFile.postId}.${previewData.extension}`;
          const originalPath = `/data/uploads/${subFile.type}/${subFile.postId}.${subFile.ogExt}`;

          reply.send({
            status: 'success',
            postId: Number(subFile.postId),
            type: subFile.type,
            previewScale: previewData.previewScale,
            aspectRatio: ratio,
            deletedPreview: !previewData.previewScale,
            assignedExt: previewData.extension,
            transType: subFile.transType,
            finalExt: subFile.ogExt,
            fileSize: finalStats.size,
            previewSize: previewData.previewSize ?? finalStats.size,
            previewPath,
            originalPath,
            hasAudio: subFile.hasAudio,
            duration: subFile.duration
          });
          resolve(); // tell fastify to send the response now
        } catch (error) {
          reject(error);
        }
      });

      req.raw.pipe(busboy);
    });
  });
};

export default uploadRoute;