export type FileType = 'IMAGE' | 'ANIMATED' | 'VIDEO';


// Dashboard Stuff
export const auditLogColors: Record<string, string> = {
  EDIT: "text-yellow-400",
  DELETE: "text-red-500",
  CREATE: "text-green-500",
  UPDATE: "text-blue-400",
  ARCHIVE: "text-pink",
};

// Any API with pagination generally follows this format
export type GenericPageInfo = { page: number, limit: number, total: number, totalPages: number };