// I hate files that are just one long function of if/elses,
// but it's imperative that we do all this linearly to prevent data loss.
// It's ugly but it works.

import fs from "fs";
import path from "path";
import Busboy from "busboy";
import { FastifyPluginAsync } from "fastify"
import { FileType, resolveFileType } from "../types/mediaTypes";
import { preProcessImage, preProcessVideo } from "../utils/Uploads/preProcessing";
import { SubFileUpload } from "../types/uploadTypes";
import { processPreviews } from "../utils/Uploads/previewProcessing";
import { generateThumbnails } from "../utils/Uploads/generateThumbnails";
import { getAspectRatio } from "../utils/Uploads/aspectRatio";
import { appLogger } from "../plugins/logger";

const logger = appLogger('Upload');

const uploadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/upload', { preHandler: fastify.verifyIp }, async (req, reply) => {
    return new Promise<void>((resolve, reject) => {
      let postId: string;
      let filePath = '';
      let convertVideos = false;
      let fileFormat: FileType;
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

      busboy.on('file', (fieldname, file, info) => {
        const { filename } = info;
        if (!postId) { return reply.code(400).send({ error: 'Missing postId' }); };
        logger.debug(`Received postId! (${postId})`);

        const ext = path.extname(filename);
        fileFormat = resolveFileType(ext); // will be 'image', 'animated', 'video', or 'other'
        filePath = path.join(process.cwd(), '/data/uploads', fileFormat, `${postId}${ext}`);
        

        const chunks: Buffer[] = [];
        file.on('data', (chunk) => chunks.push(chunk)); // save each data chunk in order

        // Once the file is done uploading, begin processing
        file.on('end', async () => {
          logger.debug(`Entire file has been received and saved to a buffer.`);
          const buffer = Buffer.concat(chunks);

          // Build skeleton before pre-processing
          subFile = {
            postId,
            ogExt: ext.replace(/^\./, ""),
            type: fileFormat,
            ogPath: filePath,
            buffer,
          }

          logger.debug(`Starting Pre-Processing for ${fileFormat}!`);
          switch (fileFormat) {
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

          // At this point, subFile contains updated information from our preprocessing,
          // and should be used as the definite source of truth.
          // Trycatches should be inside of each function, so we have a better idea of what went wrong & where.

          const previewData = await processPreviews(subFile); logger.debug(`Saved Preview!`);
          if (!previewData || previewData === null) { return reply.code(500).send({ error: 'Failed to process upload, check console for details.' }); }
          await generateThumbnails(subFile); logger.debug(`Saved Thumbnails!`);
          const ratio = await getAspectRatio(subFile); logger.debug(`Saved Aspect Ratio!`);
          const finalStats = fs.statSync(subFile.ogPath);

          const previewPath = `/data/previews/${subFile.type}/${subFile.postId}.${previewData.extension}`;
          const originalPath = `/data/uploads/${subFile.type}/${subFile.postId}.${subFile.ogExt}`;

          reply.send({
            status: 'success',
            postId: Number(subFile.postId),
            previewScale: previewData.previewScale,
            aspectRatio: ratio,
            deletedPreview: !previewData.previewScale,
            assignedExt: previewData.extension,
            transType: subFile.transType,
            finalExt: subFile.ogExt,
            fileSize: finalStats.size,
            previewSize: previewData.previewSize ?? finalStats.size,
            previewPath,
            originalPath
          });
          resolve();
        })
      });

      busboy.on('finish', () => { if (!filePath) { reply.code(400).send({ error: 'No file received' }) } });
      req.raw.pipe(busboy);
    });
  });
};

export default uploadRoute;