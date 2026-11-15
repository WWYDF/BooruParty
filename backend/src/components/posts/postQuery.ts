import { NumberFilter, ParsedQuery, Wildcard } from '@/core/utilities/search';
import { Prisma } from '../../../prisma/client';
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

  const AND: Prisma.PostWhereInput[] = [{ safety: { in: safety } }];

  // Private uploaders' posts: only visible to themselves and admins
  if (!viewer.canSeePrivate) {
    AND.push({
      OR: [
        { uploader: { private: false } },
        ...(viewer.userId ? [{ uploaderId: viewer.userId }] : []),
      ],
    });
  }


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
