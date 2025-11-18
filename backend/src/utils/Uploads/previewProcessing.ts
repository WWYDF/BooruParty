import fs from "fs";
import path from "path";
import sharp from "sharp";
import { SubFilePreview, SubFileUpload } from "../../types/uploadTypes";
import { appLogger } from "../../plugins/logger";
import { compressGif } from "./Animated/processGifs";
import { processVideoPreview } from "./videoProcessing";

const logger = appLogger('Previews');

export async function processPreviews(subFile: SubFileUpload): Promise<SubFilePreview | null> {
  const previewDir = path.join(process.cwd(), `/data/previews/${subFile.type}`);

  try {
    if (subFile.type == 'image') {
      const previewPath = path.join(previewDir, `${subFile.postId}.webp`);
      const metadata = await sharp(subFile.ogPath).metadata();
      const resizedBuffer = await sharp(subFile.ogPath)
        .resize({ width: 1280, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer();

      await fs.promises.writeFile(previewPath, resizedBuffer);

      const resizedMeta = await sharp(resizedBuffer).metadata();
      const previewScale =
        metadata.width && resizedMeta.width
          ? Math.round((resizedMeta.width / metadata.width) * 100)
          : null;

      return {
        previewPath,
        extension: 'webp',
        previewScale
      }
    }

    // Most of logic moved to sub function due to complexity and size.
    else if (subFile.type == 'video') {
      const previewDir = path.join(process.cwd(), '/data/previews/video');
      const { previewScale, assignedExt } = await processVideoPreview(subFile.ogPath, Number(subFile.postId), previewDir);
      const previewPath = path.join(previewDir, `${subFile.postId}.${assignedExt}`);
      return {
        previewPath,
        extension: `${assignedExt ?? 'webm'}`,
        previewScale
      }
    }


    else if (subFile.type == 'animated') {
      const previewPath = path.join(previewDir, `${subFile.postId}.gif`);
      await compressGif(subFile.ogPath, previewPath);
  
      const originalSize = fs.statSync(subFile.ogPath).size;
      const previewSize = fs.statSync(previewPath).size;
      let previewScale = Math.round((previewSize / originalSize) * 100);

      if (previewSize >= originalSize) {
        fs.unlinkSync(previewPath); // no benefit
        return { previewPath, extension: 'gif', previewScale: null }
      }

      return { previewPath, extension: 'gif', previewScale }
    }

    // Isn't 'image', 'video', or 'animated'. Throw error to cancel.
    throw new Error(`Type not recognized: ${subFile.type}`)
  } catch (error) {
    logger.error('Something went wrong while processing!', error);
    return null; // signal upstream to cancel
  }
}