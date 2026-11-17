import { NumberFilter, ParsedQuery, SortOrder, Wildcard } from '@/core/utilities/search';
import { Prisma, Safety, TagFlag } from '../../../prisma/client';
import { resolveTagNames } from '@/core/utilities/tags';
import { effectiveSafety, Viewer } from '@/core/utilities/viewer';

export type PostQuery =
  | { empty: true, unknownTags: string[] }
  | {
      empty: false,
      where: Prisma.PostWhereInput,
      orderBy: Prisma.PostOrderByWithRelationInput[],
      random: boolean,
      unknownTags: string[],
    };

const PRISMA_OP = { eq: 'equals', gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte' } as const;

function numberConditions(field: 'score' | 'tagCount' | 'id', filters: NumberFilter[]): Prisma.PostWhereInput[] {
  return filters.map((f) => ({ [field]: { [PRISMA_OP[f.op]]: f.value } }));
}

function wildcardCondition(wc: Wildcard): Prisma.PostTagWhereInput {
  return { tag: { name: { [wc.kind]: wc.value } } };
}

// Cursor = the last post's sort values: "500" for id orders, "15_500" (score_id) for score order
export function encodeCursor(order: SortOrder, post: { id: number, score: number }): string {
  return order === 'score' ? `${post.score}_${post.id}` : String(post.id);
}

// Condition for "rows after (or before) this cursor" in the given order, or null if the cursor is malformed.
// "after" = further down the list (what the feed's pages use); "before" = further up it (navigation).
export function cursorCondition(order: SortOrder, cursor: string, direction: 'after' | 'before' = 'after'): Prisma.PostWhereInput | null {
  const before = direction === 'before';

  if (order === 'score') {
    const m = /^(-?\d+)_(\d+)$/.exec(cursor);
    if (!m) return null;
    const score = Number(m[1]);
    const id = Number(m[2]);
    return before
      ? { OR: [{ score: { gt: score } }, { score, id: { gt: id } }] }
      : { OR: [{ score: { lt: score } }, { score, id: { lt: id } }] };
  }

  if (!/^\d+$/.test(cursor)) return null;
  const id = Number(cursor);
  // In an ascending list (oldest) "after" means bigger ids; "before" flips whichever way it is
  const ascending = order === 'oldest';
  return ascending !== before ? { id: { gt: id } } : { id: { lt: id } };
}

// The same order, backwards. Used to find the closest row BEFORE a cursor (take 1 from the reversed list).
export function reverseOrder(orderBy: Prisma.PostOrderByWithRelationInput[]): Prisma.PostOrderByWithRelationInput[] {
  return orderBy.map((o) =>
    Object.fromEntries(Object.entries(o).map(([field, dir]) => [field, dir === 'asc' ? 'desc' : 'asc'])),
  );
}


// Conditions for "posts this viewer may see" (safety + private accounts)
// Safety defaults to the viewer's default/cap
export function visibleConditions(viewer: Viewer, safety: Safety[] = effectiveSafety(viewer)): Prisma.PostWhereInput[] {
  const conditions: Prisma.PostWhereInput[] = [{ safety: { in: safety } }];

  // Private uploaders' posts: Only visible to themselves and admins
  if (!viewer.canSeePrivate) {
    conditions.push({
      OR: [
        { uploader: { private: false } },
        ...(viewer.userId ? [{ uploaderId: viewer.userId }] : []),
      ],
    });
  }

  return conditions;
}

// Build List Posts Query
export async function buildPostQuery(q: ParsedQuery, viewer: Viewer): Promise<PostQuery> {
  // Resolve all three tag lists in parallel (aliases -> real tags)
  const [inc, exc, any] = await Promise.all([
    resolveTagNames(q.include),
    resolveTagNames(q.exclude),
    resolveTagNames(q.anyOf),
  ]);
  const unknownTags = [...inc.missing, ...any.missing];

  // A required tag that doesn't exist matches nothing. Same if every ~tag is unknown.
  if (inc.missing.length) return { empty: true, unknownTags };
  if (q.anyOf.length && any.tags.length === 0) return { empty: true, unknownTags };

  const safety = effectiveSafety(viewer, q.safety);
  if (safety.length === 0) return { empty: true, unknownTags };
  if (q.type && q.type.length === 0) return { empty: true, unknownTags };

  const AND: Prisma.PostWhereInput[] = visibleConditions(viewer, safety);


  // Tags
  for (const tag of inc.tags) AND.push({ tags: { some: { tagId: tag.id } } });
  if (exc.tags.length) AND.push({ tags: { none: { tagId: { in: exc.tags.map((t) => t.id) } } } });
  if (any.tags.length) AND.push({ tags: { some: { tagId: { in: any.tags.map((t) => t.id) } } } });
  for (const wc of q.includeWildcards) AND.push({ tags: { some: wildcardCondition(wc) } });
  for (const wc of q.excludeWildcards) AND.push({ tags: { none: wildcardCondition(wc) } });

  // Fields
  if (q.type) AND.push({ type: { in: q.type } });
  if (q.from.length) AND.push({ uploader: { username: { in: q.from } } });
  if (q.notFrom.length) AND.push({ uploader: { username: { notIn: q.notFrom } } });
  for (const group of q.flags) AND.push({ tags: { some: { tag: { flags: { hasSome: group } } } } });
  if (q.notFlags.length) AND.push({ tags: { none: { tag: { flags: { hasSome: q.notFlags } } } } });

  AND.push(
    ...numberConditions('score', q.score),
    ...numberConditions('tagCount', q.tagcount),
    ...numberConditions('id', q.id),
  );

  const orderBy: Prisma.PostOrderByWithRelationInput[] =
    q.order === 'oldest' ? [{ id: 'asc' }]
    : q.order === 'score' ? [{ score: 'desc' }, { id: 'desc' }]
    : [{ id: 'desc' }]; // newest (and the base order for random)

  return { empty: false, where: { AND }, orderBy, random: q.order === 'random', unknownTags };
}
