// Tag names rules: Every tag name entering the API goes through normalizeTagName()

export const maxTagName = 96;

// Prefixes reserved for search syntax (system tags), e.g. "safety:explicit" or "uploader:dsit".
// A name like "re:zero" is fine, but "safety:foo" is not.
const RESERVED_PREFIXES = new Set([
  'id',
  'safety',
  'type',
  'from',
  'score',
  'sort',
  'order',
  'category',
  'tagcount'
]);

export type TagNameResult = 
  | { ok: true; name: string }
  | { ok: false; reason: string };


export function normalizeTagName(input: string): TagNameResult {
  const name = input
    .normalize('NFC') // so "é" typed two different ways is one tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')    // "blue sky" -> "blue_sky"
    .replace(/_+/g, '_');    // "blue__sky" -> "blue_sky"

  // Name Checks
  if (!name || name === '_') return { ok: false, reason: 'Tag name is empty.' };
  if (name.length > maxTagName) return { ok: false, reason: `Tag name exceeds ${maxTagName} characters.` };
  if (/[\p{Cc}\p{Cf}]/u.test(name)) return { ok: false, reason: 'Tag name contains invisible characters.' };
  if (/^[-~]/.test(name)) return { ok: false, reason: 'Tag name cannot start with "-" or "~".' };
  if (/[*,]/.test(name)) return { ok: false, reason: 'Tag name cannot contain "*" or ",".' };

  const colon = name.indexOf(':');
  if (colon !== -1 && RESERVED_PREFIXES.has(name.slice(0, colon))) {
    return { ok: false, reason: `"${name.slice(0, colon)}:" is reserved for search.` };
  }

  return { ok: true, name }
}