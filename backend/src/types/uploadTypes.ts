import { FileTypes } from "../utils/mediaTypes"

export type SubFileUpload = {
  postId: string | number,
  ogExt: string,
  type: FileTypes,
  buffer: Buffer,
  ogPath: string,
  transType?: FileTypes,
  duration?: number,
  hasAudio: boolean
}

export type SubFilePreview = {
  previewPath: string,
  extension: string,
  previewScale: number | null,
  previewSize?: number
}