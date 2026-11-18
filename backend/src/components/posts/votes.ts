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