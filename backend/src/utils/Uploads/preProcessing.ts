import path from "path";
import { SubFileUpload } from "../../types/uploadTypes";
import sharp from "sharp";

export async function preProcessImage(upload: SubFileUpload): Promise<SubFileUpload> {
  await sharp(upload.buffer).rotate().withMetadata().toFile(upload.ogPath); // strip EXIF data
  return upload; // Just return our original
}

export async function preProcessVideo(upload: SubFileUpload): Promise<SubFileUpload> {
  
  // Rebuild skeleton after processing
  // const subFile: SubFileUpload = {
  //   postId,
  //   ogExt: ext,
  //   type: fileFormat,
  //   ogPath: filePath,
  //   buffer,
  // }

  return upload;
  
}

export async function preProcessGIF(upload: SubFileUpload) {
  
}