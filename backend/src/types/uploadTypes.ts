import { FileType } from "./mediaTypes";

export type SubFileUpload = {
  postId: string | number,
  ogExt: string,
  type: FileType,
  buffer: Buffer,
  ogPath: string,
  transType?: FileType
}

export type SubFilePreview = {
  previewPath: string,
  extension: string,
  previewScale: number | null,
  previewSize?: number
}