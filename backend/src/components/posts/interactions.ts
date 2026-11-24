import { Db, prisma } from "@/core/plugins/prisma";
import { HttpError } from "@/core/utilities/errors";

export type ViewerState = { vote: number, favorited: boolean };
export type VoteValue = -1 | 0 | 1;

// Sets (or clears, with 0) a user's vote on a post, then recounts the post's score
// Run inside a transaction so the vote and the score always land together
export async function setVote(db: Db, postId: number, userId: string, value: VoteValue): Promise<number> {
  if (value === 0) {
    await db.postVote.deleteMany({ where: { postId, userId } });
  } else {
    await db.postVote.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, value },
      update: { value },
    });
  }

  const { _sum } = await db.postVote.aggregate({ where: { postId }, _sum: { value: true } });
  const score = _sum.value ?? 0;
  await db.post.update({ where: { id: postId }, data: { score } });
  return score;
}

// Favorites (or unfavorites) a post for a user, the recounts the post's favoriteCount
// A new favorite also likes the post when autoLike is true. Unfavoriting leaves the vote alone
// Run inside a transaction so the favorite and the count always land together
export async function setFavorite(db: Db, postId: number, userId: string, favorited: boolean, autoLike: boolean) {
  if (favorited) {
    const { count } = await db.postFavorite.createMany({ data: [{ postId, userId }], skipDuplicates: true });
    if (count > 0 && autoLike) await setVote(db, postId, userId, 1);
  } else {
    await db.postFavorite.deleteMany({ where: { postId, userId } });
  }

  const favoriteCount = await db.postFavorite.count({ where: { postId } });
  const { score } = await db.post.update({ where: { id: postId }, data: { favoriteCount }, select: { score: true } });
  return { favoriteCount, score }
}

// The viewer's vote and favorite for a whole page of posts: 2 queries total, not 2 per post
// Guests get an empty map, so "states.get(id) ?? null" gives them viewer: null
export async function getViewerStates(postIds: number[], userId: string | null, db: Db = prisma): Promise<Map<number, ViewerState>> {
  const states = new Map<number, ViewerState>();
  if (!userId || postIds.length === 0) return states;

  const [votes, favorites] = await Promise.all([
    db.postVote.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true, value: true } }),
    db.postFavorite.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
  ]);

  const voteByPost = new Map(votes.map((v) => [v.postId, v.value]));
  const favorited = new Set(favorites.map((f) => f.postId));

  for (const id of postIds) {
    states.set(id, { vote: voteByPost.get(id) ?? 0, favorited: favorited.has(id) });
  }
  return states;
}

// Recounts a post's boosts from the log
async function recountBoosts(db: Db, postId: number): Promise<number> {
  const boostCount = await db.postBoost.count({ where: { postId } });
  await db.post.update({ where: { id: postId }, data: { boostCount } });
  return boostCount;
}

// Boosts a post if the user is off cooldown, otherwise throws 429 with when they can boost next
// Run inside a transaction so the cooldown claim, log row, and count all land together
export async function boostPost(db: Db, postId: number, userId: string, cooldownSeconds: number) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - cooldownSeconds * 1000);

  // Claim the cooldown. Only one concurrent request can match this where, so only one boost lands.
  const { count } = await db.user.updateMany({
    where: { id: userId, OR: [{ lastBoostAt: null }, { lastBoostAt: { lte: cutoff } }] },
    data: { lastBoostAt: now },
  });

  if (count === 0) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { lastBoostAt: true } });
    const nextBoostAt = new Date(user!.lastBoostAt!.getTime() + cooldownSeconds * 1000);
    throw new HttpError(429, { error: 'On cooldown', hint: 'You can only boost once per cooldown', nextBoostAt });
  }

  await db.postBoost.create({ data: { postId, userId, createdAt: now } });
  const boostCount = await recountBoosts(db, postId);

  return { boostCount, nextBoostAt: new Date(now.getTime() + cooldownSeconds * 1000), activeBoostPostId: postId };
}

// Takes back the user's ACTIVE boost on this post, and clears their cooldown
// Thorws 409 if nothing to undo (no active boost here)
// (run inside transaction)
export async function undoBoost(db: Db, postId: number, userId: string, cooldownSeconds: number) {
  const cutoff = new Date(Date.now() - cooldownSeconds * 1000);
  const nothingToUndo = new HttpError(409, { error: 'Nothing to undo', hint: 'Only your latest boost can be undone, before the cooldown ends' });

  const user = await db.user.findUnique({ where: { id: userId }, select: { lastBoostAt: true } });
  const lastBoostAt = user?.lastBoostAt;
  if (!lastBoostAt || lastBoostAt <= cutoff) throw nothingToUndo;

  // The active boost is the log row written in the same moment as lastBoostAt (or most recent lol)
  const { count } = await db.postBoost.deleteMany({ where: { userId, postId, createdAt: lastBoostAt } });
  if (count === 0) throw nothingToUndo;

  // Refund the cooldown, but only if its still the one this boost started
  await db.user.updateMany({ where: { id: userId, lastBoostAt }, data: { lastBoostAt: null } });

  const boostCount = await recountBoosts(db, postId);
  return { boostCount, nextBoostAt: null, activeBoostPostId: null };
}


// The user's cooldown as the UI needs it: when they can boost next, and which post their undoable boost is on.
// Both null = off cooldown, free to boost.
export async function getBoostState(db: Db, userId: string, lastBoostAt: Date | null, cooldownSeconds: number) {
  const cutoff = Date.now() - cooldownSeconds * 1000;
  if (!lastBoostAt || lastBoostAt.getTime() <= cutoff) return { nextBoostAt: null, activeBoostPostId: null };

  const active = await db.postBoost.findFirst({ where: { userId, createdAt: lastBoostAt }, select: { postId: true } });
  return {
    nextBoostAt: new Date(lastBoostAt.getTime() + cooldownSeconds * 1000),
    activeBoostPostId: active?.postId ?? null,
  };
}

// Recounts score for many posts in one statement (bulk version of the recount in setVote)
export async function recountScores(db: Db, postIds: number[]) {
  await db.$executeRaw`
    UPDATE "Post" p
    SET score = COALESCE((SELECT SUM(v.value) FROM "PostVote" v WHERE v."postId" = p.id), 0)
    WHERE p.id = ANY(${postIds})`;
}

// Recounts favoriteCount for many posts in one statement (bulk version of the recount in setFavorite)
export async function recountFavorites(db: Db, postIds: number[]) {
  await db.$executeRaw`
    UPDATE "Post" p
    SET "favoriteCount" = (SELECT COUNT(*) FROM "PostFavorite" f WHERE f."postId" = p.id)
    WHERE p.id = ANY(${postIds})`;
}
