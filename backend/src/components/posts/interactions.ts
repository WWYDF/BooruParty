import { Db, prisma } from "@/core/plugins/prisma";

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