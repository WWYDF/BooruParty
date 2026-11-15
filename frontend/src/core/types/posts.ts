import { FileType } from "../dictionary";
import { Tag, TagGroup } from "./tags";
import { UserSimpleSummary } from "./users";

export type Safety = 'SAFE' | 'QUESTIONABLE' | 'EXPLICIT';

// Returned when searching an individual post
export type Post = {
  id: number,
  type: FileType,
  safety: Safety,
  fileKey: string,
  aspectRatio: number,
  sources: string[],
  notes: string | null,
  
  fileSize: number, // bytes
  previewSize: number, // bytes
  duration: number | null,
  hasAudio: boolean,

  score: number,
  tags: [],

  createdAt: Date,
  uploader: UserSimpleSummary,

  originalPath: string,
  previewPath: string,
  thumbnails: {
    small: string,
    med: string,
    large: string,
  }
}

// Returned when searching the Posts page(s)
export type Posts = {
  id: number,
  type: FileType,
  safety: Safety,
  fileKey: string,
  aspectRatio: number,
  sources: string[],
  notes: string | null,
  
  duration: number | null,
  hasAudio: boolean,

  score: number,
  createdAt: Date,

  thumbnails: {
    small: string,
    med: string,
    large: string,
  }
}

export type PostUserStatus = {
  vote: 'UPVOTE' | 'DOWNVOTE' | null,
  favorited: boolean
  signedIn: boolean
  boostOnCooldown: boolean,
  canAutoTag: boolean,
  collections: string[], // what collections the post is in (ids)
}

export type PostNavigatorType = {
  previousPostId: number;
  nextPostId: number;
}


// Fastify Response
export type FastifyUpload = {
  status: string,
  postId: number,
  type: FileType,
  previewScale: number | null,
  aspectRatio: number,
  deletedPreview?: boolean,
  fileName?: string
  assignedExt: 'mp4' | 'webm' | 'mkv' | 'webp' | 'gif' | null,
  transType?: FileType,
  finalExt: 'mp4' | 'webm' | 'mkv' | 'webp' | 'gif',
  fileSize: number,
  previewSize?: number,
  previewPath: string,
  originalPath: string,
  duration?: number,
  hasAudio: boolean,
}