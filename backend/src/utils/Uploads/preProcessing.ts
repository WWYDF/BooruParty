import fs from "fs";
import path from "path";
import sharp from "sharp";
import { promisify } from "util";
import { exec } from "child_process";
import { createAnimatedWebp } from "./Animated/processAnimations";
import { SubFileUpload } from "../../types/uploadTypes";
import { appLogger } from "../../plugins/logger";

const logger = appLogger('Processing');
const execAsync = promisify(exec);

export async function preProcessImage(upload: SubFileUpload): Promise<SubFileUpload> {
  await sharp(upload.buffer).rotate().withMetadata().toFile(upload.ogPath); // strip EXIF data
  return upload; // Just return our original
}

export async function preProcessVideo(upload: SubFileUpload, convertVideos: boolean): Promise<SubFileUpload> {

  await fs.promises.writeFile(upload.ogPath, upload.buffer); // write file regardless
  logger.debug(`Wrote file to: ${upload.ogPath}`);

  // Here, we just check if the uploaded video is both short & muted.
  // If so, convert it to an animation for easy looping.

  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration,stream=codec_type -of json "${upload.ogPath}"`
  );

  const data = JSON.parse(stdout.toString());
  logger.debug(`Successfully parsed stdout from ffprobe.`);

  const duration = parseFloat(data.format.duration);
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const hasAudio = streams.some((s: any) => s.codec_type === "audio");
  
  const isShort = duration < 5;
  const isMute = !hasAudio;
  logger.verbose(`Finished video tests.`);

  // If true, convert to an animation, and update subFile.
  if (isShort && isMute && convertVideos == true) {
    logger.debug(`Short & mute video detected! Converting to animation...`);
    const outputPath = path.join(process.cwd(), `/data/temp/${upload.postId}.webp`);
    const createWebp = await createAnimatedWebp(upload.ogPath, outputPath);
    if (!createWebp) { return upload }; // something went wrong, don't process, and keep treating as video.
    logger.debug(`Successfully created animated webp in the temp folder.`);

    await fs.promises.unlink(upload.ogPath); // remove old video file
    logger.debug(`Removed old video file.`);
    const newPath = path.join(process.cwd(), `/data/uploads/animated/${upload.postId}.webp`);
    fs.renameSync(outputPath, newPath);
    const buffer = fs.readFileSync(newPath);
    logger.debug(`Moved temp file to deep storage and created a new buffer.`);

    // Rebuild skeleton after processing
    const newSubFile: SubFileUpload = {
      postId: upload.postId,
      ogExt: 'webp',
      type: 'animated',
      ogPath: newPath,
      buffer,
      transType: 'animated' // tell NextJS that we converted it to an animation
    }

    logger.debug(`Returning updated subFile.`);
    return newSubFile;
  }
  // otherwise, return og video file
  return upload;
}

export async function preProcessGIF(upload: SubFileUpload) {
  
}