import { MultipartFile } from "@fastify/multipart";
import { Safety } from "../../../prisma/client"

export type UploadFields = {
  safety: Safety,
  sources: string[],
  notes: string | null,
  tags: string[],
}

type ParseResult = { ok: true, fields: UploadFields } | { ok: false, error: string };

// Just to prevent abuse on creation
export const MAX_SOURCES = 10;
export const MAX_SOURCE_LENGTH = 512;
export const MAX_NOTES_LENGTH = 2048;
export const MAX_TAGS = 300;

export function getField(upload: MultipartFile, name: string): string | undefined {
  const field = upload.fields[name];
  const part = Array.isArray(field) ? field[0] : field;
  return part && part.type === 'field' ? String(part.value) : undefined;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false
  }
}

// Reads and validates the post's text fields. Must be sent BEFORE the file in the form.
export function parseUploadFields(upload: MultipartFile): ParseResult {

  // Safety (required)
  const safety = getField(upload, 'safety');
  if (!safety || !Object.values(Safety).includes(safety as Safety)) {
    return { ok: false, error: `safety must be one of: ${Object.values(Safety).join(', ')}` };;
  }

  // Sources (optional JSON array of URLs)
  let sources: string[] = [];
  const rawSources = getField(upload, 'sources');
  if (rawSources) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawSources);
    } catch {
      return { ok: false, error: `sources must be a JSON array of URLs` };
    }
    if (!Array.isArray(parsed) || parsed.length > MAX_SOURCES) {
      return { ok: false, error: `sources must be an array of at most ${MAX_SOURCES} URLs` };
    }
    for (const s of parsed) {
      if (typeof s !== 'string' || s.length > MAX_SOURCE_LENGTH || !isHttpUrl(s.trim())) {
        return { ok: false, error: `Invalid source URL: ${String(s).slice(0, 100)}` };
      }
    }
    sources = [...new Set(parsed.map((s: string) => s.trim()))];
  }

  // Notes (optional)
  const notes = getField(upload, 'notes')?.trim() || null;
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return { ok: false, error: `notes must be at most ${MAX_NOTES_LENGTH} characters` };
  }

  // Tags (optional JSON array of names; normalized + resolved later in the route)
  let tags: string[] = [];
  const rawTags = getField(upload, 'tags');
  if (rawTags) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawTags);
    } catch {
      return { ok: false, error: `tags must be a JSON array of tag names` };
    }
    if (!Array.isArray(parsed) || parsed.length > MAX_TAGS || !parsed.every((t) => typeof t === 'string')) {
      return { ok: false, error: `tags must be an array of at most ${MAX_TAGS} tag names` };
    }
    tags = parsed;
  }

  return { ok: true, fields: { safety: safety as Safety, sources, notes, tags } };
}