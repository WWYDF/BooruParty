import fs from "fs";
import path from "path";
import Busboy from "busboy";
import { FastifyPluginAsync } from "fastify"
import { FileType, resolveFileType } from "../types/mediaTypes";
import { preProcessImage, preProcessVideo } from "../utils/Uploads/preProcessing";
import { SubFileUpload } from "../types/uploadTypes";
import { processPreviews } from "../utils/Uploads/previewProcessing";
import { generateThumbnails, thumbnailSizes } from "../utils/Uploads/generateThumbnails";
import { getAspectRatio } from "../utils/Uploads/aspectRatio";
import { appLogger } from "../plugins/logger";
import { deletePostData } from "../utils/cleanupPost";

const logger = appLogger('Replacer');

// For replacing content entirely
// Basically 1:1 from /upload, but has some changes,
// And I would rather keep them separate rather than making
// Some "all-in-one" zombie function...
const postReplaceRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/replace', async (req, reply) => {
    return new Promise<void>((resolve, reject) => {
      let postId: string;
      let filePath = '';
      let fileFormat: FileType;
      let subFile: SubFileUpload;

      const busboy = Busboy({ headers: req.headers });
      logger.debug('Received file!');
      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'postId' && /^\d+$/.test(value)) {
          postId = value;
        }
      });

      busboy.on('file', (fieldname, file, info) => {
        const { filename } = info;
        if (!postId) { logger.warn(`Missing postId, returning code 400...`); return reply.code(400).send({ error: 'Missing postId' }); };
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

          // Cleanup previous postData
          await deletePostData(postId);

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
              subFile = await preProcessVideo(subFile);
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

const thumbnailReplaceRoute: FastifyPluginAsync = async (fastify) => {
  // For replacing thumbnails on videos
  fastify.post('/replace/thumbnail', async (req, reply) => {
    return new Promise<void>((resolve) => {
      let postId: string | undefined;
      const busboy = Busboy({ headers: req.headers });

      let fileBuffer: Buffer[] = [];
      let ext = '';

      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'postId' && /^\d+$/.test(value)) {
          postId = value;
        }
      });

      busboy.on('file', (fieldname, file, info) => {
        const { filename } = info;
        ext = path.extname(filename);

        file.on('data', chunk => fileBuffer.push(chunk));
      });

      busboy.on('finish', async () => {
        if (!postId || !fileBuffer.length) {
          return reply.code(400).send({ error: 'Missing postId or file' });
        }

        const fileFormat = resolveFileType(ext);

        if (fileFormat !== 'image') { return reply.status(400).send({ success: false, error: "You must provide an IMAGE." }); } 

        // Clean up old thumbnails
        await deletePostData(String(postId), true);

        const buffer = Buffer.concat(fileBuffer);
        const tempFile = path.join(process.cwd(), `data/temp/${postId}_frame.${ext}`);
        fs.writeFileSync(tempFile, buffer);

        const subFile: SubFileUpload = {
          postId,
          ogExt: ext,
          type: 'video',
          buffer,
          ogPath: tempFile
        }

        await generateThumbnails(subFile);

        reply.send({ status: 'success', postId });
        resolve();
      });

      req.raw.pipe(busboy);
    });
  });
}

export { postReplaceRoute, thumbnailReplaceRoute };