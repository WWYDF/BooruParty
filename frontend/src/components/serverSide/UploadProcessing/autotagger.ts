import { PredictTag } from "@/app/api/addons/autotagger/route";
import { AutoTaggerShape } from "@/core/types/dashboard";
import { Tag } from "@/core/types/tags";
import { Client } from "@gradio/client";

type FetchedShape = {
  matches: {
    tag: Tag;
    score: number;
    matchedName: string;
  }[];
  nonMatched: {
    name: string;
    score: number;
  }[];
};

/**
 * Accepts wd-14 AutoTaggerShape and returns a flat array of {name, score},
 * collapsing duplicates by max(score) and discarding ratings entirely.
 */
export function normalizeResponse(raw: AutoTaggerShape): PredictTag[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const ratingDrop = new Set(["general", "sensitive", "questionable", "explicit"]);
  const maxByName = new Map<string, number>();

  for (const item of raw) {
    if (!item || !Array.isArray(item.confidences)) continue;
    for (const c of item.confidences) {
      const label = String(c?.label ?? "").trim();
      if (!label || ratingDrop.has(label)) continue;

      const name = label.toLowerCase().replace(/[\s\-]+/g, "_").replace(/_+/g, "_");
      const score = Number(c?.confidence ?? 0);
      if (!Number.isFinite(score)) continue;

      const prev = maxByName.get(name);
      if (prev === undefined || score > prev) maxByName.set(name, score);
    }
  }

  const arr: PredictTag[] = Array.from(maxByName, ([name, score]) => ({ name, score }));
  arr.sort((a, b) => b.score - a.score);
  return arr;
}

/**
 * Server-side wd-14 autotagger processor
 * - Sends the image file to the configured wd-14 Gradio server
 * - Normalizes the returned tags
 * - Resolves canonical tags through /api/tags/batch
 * - Returns { matches, nonMatched }
 */
export async function fetchAutoTags(file: File, url: string): Promise<FetchedShape> {
  try {
    // Call wd-14 via Gradio Client
    const client = await Client.connect(url);
    const wd = (await client.predict("/predict", {
      image: file,
      model_repo: "SmilingWolf/wd-swinv2-tagger-v3",
      general_thresh: 0,
      general_mcut_enabled: true,
      character_thresh: 0,
      character_mcut_enabled: true,
    })).data as AutoTaggerShape;

    // Normalize wd-14 to our system
    const predicted = normalizeResponse(wd);
    if (predicted.length === 0) return { matches: [], nonMatched: [] };

    // Prepare resolver inputs
    const scoreByLowerName = new Map<string, number>();
    for (const p of predicted) scoreByLowerName.set(p.name.toLowerCase(), p.score);

    const names = Array.from(new Set(predicted.map((p) => p.name).filter(Boolean)));

    // Grab a batch of matching tags
    const resolveResp = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/tags/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    });

    if (!resolveResp.ok) {
      console.error("Resolver failed", resolveResp.status);
      return { matches: [], nonMatched: [] };
    }

    const resolved = await resolveResp.json();
    const resolvedTags = Array.isArray(resolved) ? resolved : [];

    // Match tags and build matches/nonMatched
    const matches = resolvedTags.map((tag: any) => {
      const candidates: string[] = [
        String(tag?.name || ""),
        ...(Array.isArray(tag?.aliases) ? tag.aliases.map((a: any) => String(a.alias || "")) : []),
      ].filter(Boolean);

      let bestScore = -Infinity;
      let matchedName = "";
      for (const c of candidates) {
        const s = scoreByLowerName.get(c.toLowerCase());
        if (typeof s === "number" && s > bestScore) {
          bestScore = s;
          matchedName = c;
        }
      }
      if (!Number.isFinite(bestScore)) bestScore = 0;
      return { tag, score: bestScore, matchedName };
    });

    matches.sort((a, b) => b.score - a.score);

    const matchedNameSet = new Set<string>(
      matches.map((m) => m.matchedName.toLowerCase()).filter(Boolean)
    );

    const nonMatched = predicted
      .filter((p) => !matchedNameSet.has(p.name.toLowerCase()))
      .sort((a, b) => b.score - a.score);


    // console.log(JSON.stringify({matches, nonMatched}, null, 1))
    return { matches, nonMatched };
  } catch (err: any) {
    console.error("fetchAutoTags error:", err?.message || err);
    return { matches: [], nonMatched: [] };
  }
}
