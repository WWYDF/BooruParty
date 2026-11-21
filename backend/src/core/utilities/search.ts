import { FileType, Safety, TagFlag } from "../../../prisma/client";
import { normalizeTagName } from "./tags";

const MAX_TERMS = 40; // every tag term becomes a subquery; keep searches bounded
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type NumberOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte';
export type NumberFilter = { op: NumberOp, value: number, };
export type Wildcard = { kind: 'startsWith' | 'endsWith' | 'contains', value: string };
export type UserFilter = { include: string[], exclude: string[] };
export type PoolsFilter = { include: number[], exclude: number[] };
export type CollectionsFilter = { include: string[], exclude: string[] };

export const SORT_ORDERS = ['newest', 'oldest', 'score', 'favorites', 'boosts', 'random'] as const;
export type SortOrder = typeof SORT_ORDERS[number];

export type ParsedQuery = {
  include: string[],              // must have all of these tags
  exclude: string[],              // must have none of these
  anyOf: string[],                // must have at least one (from ~terms)
  includeWildcards: Wildcard[],
  excludeWildcards: Wildcard[],
  safety?: Safety[],              // undefined = search didn't say; viewer default applies
  type?: FileType[],
  flags: TagFlag[][],
  notFlags: TagFlag[],
  from: UserFilter,               // uploader username ("posts:" does the same thing)
  likes: UserFilter,              // "likes:<username>"
  favorites: UserFilter           // "favorites:<username>"
  score: NumberFilter[],
  tagcount: NumberFilter[],
  pools: PoolsFilter,
  collections: CollectionsFilter,

  id: NumberFilter[],
  order: SortOrder,
  errors: string[],
};

// "safe,explicit" -> [SAFE, EXPLICIT], or null if any value is unknown
function parseEnumList<T extends string>(value: string, allowed: readonly T[]): T[] | null {
  const out: T[] = [];
  for (const part of value.split(',').filter(Boolean)) {
    const match = allowed.find((a) => a.toLowerCase() === part);
    if (!match) return null;
    out.push(match);
  }
  return out.length ? out : null;
}

// ">10" | ">=10" | "<10" | "<=10" | "10"
function parseNumberFilter(value: string): NumberFilter | null {
  const m = /^(>=|<=|>|<)?(-?\d{1,9})$/.exec(value);
  if (!m) return null;
  const op = ({ '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte' } as const)[m[1] as '>'] ?? 'eq';
  return { op, value: Number(m[2]) };
}

// "blue_*" | "*_sky" | "*blue*"; a * in the middle isn't supported
function parseWildcard(token: string): Wildcard | null {
  const start = token.startsWith('*');
  const end = token.endsWith('*');
  const value = token.replace(/^\*|\*$/g, '');
  if (!value || value.includes('*')) return null;
  return { kind: start && end ? 'contains' : start ? 'endsWith' : 'startsWith', value };
}

// Applies a positive or negated enum term on top of earlier ones (multiple terms narrow the result)
function narrow<T extends string>(current: T[] | undefined, values: T[], negate: boolean, all: readonly T[]): T[] {
  const next = negate ? all.filter((v) => !values.includes(v)) : values;
  return current ? current.filter((v) => next.includes(v)) : next;
}

export function parseSearch(input: string): ParsedQuery {
  const q: ParsedQuery = {
    include: [],
    exclude: [],
    anyOf: [],
    includeWildcards: [],
    excludeWildcards: [],
    flags: [],
    notFlags: [],
    from: { include: [], exclude: [] },
    likes: { include: [], exclude: [] },
    favorites: { include: [], exclude: [] },
    pools: { include: [], exclude: [] },
    collections: { include: [], exclude: [] },
    score: [],
    tagcount: [],
    id: [],
    order: 'newest',
    errors: [],
  };

  const tokens = input.normalize('NFC').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length > MAX_TERMS) {
    q.errors.push(`Too many search terms (max ${MAX_TERMS})`);
    return q;
  }

  for (const raw of tokens) {
    let token = raw;
    const negate = token.startsWith('-');
    const or = token.startsWith('~');
    if (negate || or) token = token.slice(1);
    if (!token) continue;

    // System terms: key:value pair
    const colon = token.indexOf(':');
    const key = colon > 0 ? token.slice(0, colon) : '';
    const value = colon > 0 ? token.slice(colon + 1) : '';

    if (key && or && [
      'safety',
      'type',
      'from',
      'likes',
      'favorites',
      'score',
      'tagcount',
      'id',
      'order',
      'sort',
      'flag',
      'flags',
      'pool',
      'collection',
    ].includes(key)) {
      q.errors.push(`"~" can't be used with ${key}:`);
      continue;
    }

    switch (key) {
      case 'safety': {
        const values = parseEnumList(value, Object.values(Safety));
        if (!values) { q.errors.push(`safety: must be ${Object.values(Safety).join(', ').toLowerCase()}`); continue; }
        q.safety = narrow(q.safety, values, negate, Object.values(Safety));
        continue;
      }
      case 'type': {
        const values = parseEnumList(value, Object.values(FileType));
        if (!values) { q.errors.push(`type: must be ${Object.values(FileType).join(', ').toLowerCase()}`); continue; }
        q.type = narrow(q.type, values, negate, Object.values(FileType));
        continue;
      }
      case 'flag': // flags: works too
      case 'flags': {
        const values = parseEnumList(value, Object.values(TagFlag));
        if (!values) { q.errors.push(`${key}: must be ${Object.values(TagFlag).join(', ').toLowerCase()}`); continue; }
        if (negate) q.notFlags.push(...values);
        else q.flags.push(values);
        continue;
      }
      // This whole block does the same function below btw
      case 'posts':
      case 'from':
      case 'likes':
      case 'favorites': {
        if (!value) { q.errors.push(`${key}: needs a username`); continue; }
        const filter = key === 'posts' ? q.from : q[key];
        (negate ? filter.exclude : filter.include).push(value);
        continue;
      }
      case 'score':
      case 'tagcount':
      case 'id': {
        if (negate) { q.errors.push(`-${key}: isn't supported; use the opposite comparison`); continue; }
        const filter = parseNumberFilter(value);
        if (!filter) { q.errors.push(`${key}: must look like 10, >10, >=10, <10 or <=10`); continue; }
        q[key].push(filter);
        continue;
      }
      case 'pool': {
        // up to 9 digits so it always fits in an int4 (no MAX_INT check needed)
        const id = /^\d{1,9}$/.test(value) ? Number(value) : 0;
        if (id < 1) { q.errors.push(`pool: needs a pool id`); continue; }
        (negate ? q.pools.exclude : q.pools.include).push(id);
        continue;
      }
      case 'collection': {
        // ids are uuids; the input is already lowercased, which matches what Prisma gens
        if (!UUID_REGEX.test(value)) { q.errors.push(`collection: needs a collection id`); continue; }
        (negate ? q.collections.exclude : q.collections.include).push(value);
        continue;
      }
      case 'order': // same as sort, just fall through
      case 'sort': {
        if (negate) { q.errors.push(`-${key}: isn't supported`); continue; }
        if (!(SORT_ORDERS as readonly string[]).includes(value)) {
          q.errors.push(`${key}: must be one of ${SORT_ORDERS.join(', ')}`);
          continue;
        }
        q.order = value as SortOrder;
        continue;
      }
    }

    // Wildcard tags
    if (token.includes('*')) {
      if (or) { q.errors.push(`"~" can't be used with wildcards`); continue; }
      const wc = parseWildcard(token);
      if (!wc) { q.errors.push(`"${raw}": wildcards only work at the start or end`); continue; }
      (negate ? q.excludeWildcards : q.includeWildcards).push(wc);
      continue;
    }

    // Plain tags (anything with an unknown "key:" is a tag name, e.g. re:zero)
    const n = normalizeTagName(token);
    if (!n.ok) { q.errors.push(`"${raw}": ${n.reason}`); continue; }
    (negate ? q.exclude : or ? q.anyOf : q.include).push(n.name);
  }

  return q;
}