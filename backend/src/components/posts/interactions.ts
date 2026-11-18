import { Db } from "@/core/plugins/prisma";

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