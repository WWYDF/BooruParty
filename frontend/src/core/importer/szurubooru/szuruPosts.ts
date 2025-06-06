import { makeImportLogger } from "../importUtils";
import { prisma } from "@/core/prisma";

export async function processSzuruPosts({
  sessionId,
  url,
  username,
  password,
  userCookie,
  limit,
}: {
  sessionId: string;
  url: string;
  username: string;
  password: string;
  userCookie: string;
  limit: number;
}) {
  let processed = 0;
  const log = makeImportLogger(sessionId);
  const auth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  const idMap = new Map<number, number>();
  const postRelationPairs: Array<[number, number]> = [];

  const allUsers = await prisma.user.findMany({ select: { id: true, username: true } });
  const userLookup = new Map(
    allUsers.map(user => [user.username.toLowerCase(), user.id])
  );

  await log("info", `Starting post import from Szuru of ${limit} posts...`);

  let offset = Math.max(0, Math.ceil(limit / 100) * 100 - 100);
  
  while (processed < limit && offset >= 0) {
    const res = await fetch(`${url}/api/posts?limit=100&offset=${offset}&query=*`, {
      headers: { 
        "Authorization": auth,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
    });

    if (!res.ok) {
      await log("error", `Failed to fetch posts: ${res.statusText}`);
      return false;
    }

    const data = await res.json();
    const posts = data.results;
    if (!posts.length) break;

    for (const post of posts.reverse()) {
      if (processed >= limit) break;
      const start = performance.now();

      if (!["image", "animation", "video"].includes(post.type)) {
        await log("error", `Unsupported post type \"${post.type}\" for post ${post.id}!`);
        break;
      }

      const fullUrl = `${url}/${post.contentUrl}`;
      let fileBlob: Blob;

      try {
        const fileRes = await fetch(fullUrl, { headers: { Authorization: auth } });
        const buffer = await fileRes.arrayBuffer();
        fileBlob = new Blob([buffer], { type: post.mimeType });
      } catch (e) {
        await log("error", `Failed to download post ${post.id}: ${e}`);
        return false;
      }

      const tags = [
        ...new Set(
          (post.tags ?? [])
            .filter((t: any) => t?.names?.length)
            .map((t: any) => t.names[0].toLowerCase())
        ),
      ];

      const szuruPoster = post.user?.name?.toLowerCase();
      const matchingUserId = szuruPoster ? userLookup.get(szuruPoster) : null;
      const finalUploaderId = matchingUserId ?? '0';

      const form = new FormData();
      form.append("file", fileBlob, `szuru-${post.id}.${post.mimeType.split("/")[1]}`);
      form.append("safety", post.safety.toUpperCase());
      form.append("source", JSON.stringify(post.source ? [post.source] : []));
      form.append("tags", JSON.stringify(tags));
      if (!matchingUserId && szuruPoster) { form.append("anonymous", "true") }

      try {
        const uploadRes = await fetch(`${process.env.NEXTAUTH_URL}/api/posts/create?skipDupes=true`, {
          method: "POST",
          headers: {
            "Cookie": userCookie,
            'X-Override': `${process.env.INTERNAL_API_SECRET}`
          },
          body: form,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.text();
          await log("error", `Upload failed for post #${post.id}: ${err}`);
          return false;
        } else {
          const json = await uploadRes.json();
          idMap.set(post.id, json.postId);

          await prisma.posts.update({
            where: { id: json.postId },
            data: { uploadedById: finalUploaderId },
          });

          const elapsed = performance.now() - start;
          const timeMs = `${elapsed.toFixed(2)}ms`
          if (!matchingUserId && szuruPoster) {
            await log("info", `Assigned fallback user (ID 0) to post #${json.postId}, originally by '${szuruPoster}' (${timeMs})`);
          } else if (matchingUserId) {
            await log("info", `Assigned post #${json.postId} to user '${szuruPoster}' (${timeMs})`);
          }

          if (post.relations?.length) {
            for (const rel of post.relations) {
              postRelationPairs.push([post.id, rel.id]);
            }
          }

          processed++;
        }
      } catch (e) {
        await log("error", `Exception during post #${post.id} upload: ${e}`);
        return false;
      }
    }

    offset -= 100;
  }

  await log("info", "Processing related posts...");
  for (const [fromSzuruId, toSzuruId] of postRelationPairs) {
    const fromId = idMap.get(fromSzuruId);
    const toId = idMap.get(toSzuruId);
    if (!fromId || !toId) continue;

    try {
      await prisma.postRelation.upsert({
        where: { fromId_toId: { fromId, toId } },
        update: {},
        create: { fromId, toId },
      });
      await log("info", `Added related posts to #${toId}...`);
    } catch (e) {
      await log("error", `Failed to create relation ${fromSzuruId} → ${toSzuruId}: ${e}`);
    }
  }
  await log("info", "Finished adding related posts...");

  await log("info", `Post import complete. Imported ${processed} post${processed !== 1 ? "s" : ""}.`);
  return true;
}
