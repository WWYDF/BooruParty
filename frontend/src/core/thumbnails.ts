// Small thumbnails generated in the browser, so the upload page never renders full-size files

const THUMB_SIZE = 320; // longest side, in px

type Frame = { source: CanvasImageSource; width: number; height: number; cleanup: () => void };

// Images (and the first frame of GIFs/animated WebP)
async function imageFrame(file: File): Promise<Frame> {
  const bitmap = await createImageBitmap(file);
  return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() };
}

// Videos: seek a little way in (the very first frame is often black) and grab that frame
function videoFrame(file: File): Promise<Frame> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const cleanup = () => { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); };

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => { video.currentTime = Math.min(1, (video.duration || 0) / 4); };
    video.onseeked = () => resolve({ source: video, width: video.videoWidth, height: video.videoHeight, cleanup });
    video.onerror = () => { cleanup(); reject(new Error('Could not decode video')); };
    video.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
}

// Returns an object URL for a small WebP thumbnail, or null if the browser can't decode the file.
// Remember to URL.revokeObjectURL() it when the file is removed.
export async function makeLocalThumbnail(file: File): Promise<string | null> {
  let frame: Frame | null = null;
  try {
    frame = file.type.startsWith('video/') ? await videoFrame(file) : await imageFrame(file);
    if (!frame.width || !frame.height) return null;

    const scale = Math.min(1, THUMB_SIZE / Math.max(frame.width, frame.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(frame.width * scale);
    canvas.height = Math.round(frame.height * scale);
    canvas.getContext('2d')?.drawImage(frame.source, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas);
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  } finally {
    frame?.cleanup();
  }
}
