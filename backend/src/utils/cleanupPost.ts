import { appLogger } from "../plugins/logger";
import path from "path";
import fs from "fs/promises";

const logger = appLogger('Recycler');

export const mediaFolders = [
  "data/uploads/image",
  "data/uploads/video",
  "data/uploads/animated",
  "data/previews/image",
  "data/previews/animated",
  "data/previews/video",
  "data/thumbnails",
];

// Helper to decide if a given filename belongs to a post id in a folder
function fileBelongsToPost(file: string, idStr: string, folder: string, thumbnailsOnly?: boolean): boolean {
  const isThumbnailFolder = folder.includes("thumbnails") || thumbnailsOnly;

  // Thumbnails: id_small.webp, id_med.webp, id_large.webp
  if (isThumbnailFolder) {
    return (
      file === `${idStr}_small.webp` ||
      file === `${idStr}_med.webp` ||
      file === `${idStr}_large.webp`
    );
  }

  // Uploads & previews:
  // Uses same sketchy startsWith causing the problem before, ik
  // Second condition is if the length of the ID +1 slot is the . (for extension), then we're good.
  // So 21.webp, 3rd slot is the dot. So the length of 21 is 2 + 1 = 3. 3rd slot.
  if (file.startsWith(idStr) && file[idStr.length] === ".") { return true; };

  return false;
}


export async function deletePostData(id: string, thumbnailsOnly?: boolean) {
  logger.info(`Attempting to delete post #${id}...`);

  for (const folder of mediaFolders) {
    try {
      const files = await fs.readdir(folder);

      const matches = files.filter((file) =>
        fileBelongsToPost(file, id, folder, thumbnailsOnly)
      );

      for (const file of matches) {
        const filePath = path.join(folder, file);
        try {
          logger.warn(`Deleting file: ${filePath}!`);
          await fs.unlink(filePath);
          logger.verbose(`Deleted file successfully.`)
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            logger.error(`Failed to delete ${filePath}: ${err}`);
          }
        }
      }
    } catch (err) {
      logger.error(`Could not read ${folder}: ${err}`);
    }
  }
}