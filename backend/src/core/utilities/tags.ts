// Tag names rules: Every tag name entering the API goes through normalizeTagName()

import { Prisma } from "../../../prisma/client";
import { prisma } from "../plugins/prisma";

// Lets helpers run either standalone or inside a prisma.$transaction(async (tx) => ...)
export type Db = typeof prisma | Prisma.TransactionClient;

export type ResolvedTag = { id: number, name: string };

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


// ----------------------------------------------
export type ResolveResult = {
  tags: ResolvedTag[], // unique tags found (aliases resolved to the real tag)
  missing: string[], // valid names that don't exist yet (normalized)
  invalid: { input: string, reason: string }[],
};

export async function resolveTagNames(inputs: string[], db: Db = prisma): Promise<ResolveResult> {
  const invalid: ResolveResult['invalid'] = [];
  const names = new Set<string>();

  for (const input of inputs) {
    const result = normalizeTagName(input);
    if (result.ok) names.add(result.name);
    else invalid.push({ input, reason: result.reason });
  }

  if (names.size === 0) return { tags: [], missing: [], invalid };

  const rows = await db.tagName.findMany({
    where: { name: { in: [...names] } },
    select: { name: true, tag: { select: { id: true, name: true } } }
  });

  const tags = new Map<number, ResolvedTag>();
  const matched = new Set<string>();

  for (const row of rows) {
    tags.set(row.tag.id, row.tag);
    matched.add(row.name);
  }

  const missing = [...names].filter((n) => !matched.has(n));

  return { tags: [...tags.values()], missing, invalid };
}


// ----------------------------------------------
// Everything the given tags imply, following chains (pikachu -> pokemon -> nintendo).
// The input tags themselves are excluded from the result.
export type ImpliedTag = ResolvedTag & { categoryId: number };

export async function getImpliedTags(tagIds: number[], db: Db = prisma): Promise<ImpliedTag[]> {
  if (tagIds.length === 0) return [];

  return db.$queryRaw<ImpliedTag[]>`
    WITH RECURSIVE implied AS (
      SELECT ti."impliedId" AS id
      FROM "TagImplication" ti
      WHERE ti."tagId" = ANY(${tagIds}::int[])

      UNION

      SELECT ti."impliedId"
      FROM "TagImplication" ti
      JOIN implied i ON ti."tagId" = i.id
    )
    SELECT t.id, t.name, t."categoryId"
    FROM implied
    JOIN "Tag" t ON t.id = implied.id
    WHERE NOT (t.id = ANY(${tagIds}::int[]))
  `;
}

// Would adding "tagId implies impliedId" create a loop?
export async function wouldCreateCycle(tagId: number, impliedId: number, db: Db = prisma): Promise<boolean> {
  if (tagId === impliedId) return true;

  const reachable = await getImpliedTags([impliedId], db);
  return reachable.some((t) => t.id === tagId);
}