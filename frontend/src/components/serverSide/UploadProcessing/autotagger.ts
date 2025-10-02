import { normalizeResponse } from "@/app/api/addons/autotagger/route";
import { AutoTaggerShape } from "@/core/types/dashboard";
import { Tag } from "@/core/types/tags";

type FetchedShape = {
  matches: {
    tag: Tag,
    score: number,
    matchedName: string,
  }[],
  nonMatched: {
    name: string,
    score: number
  }[]
}

export async function fetchAutoTags(file: File, url: string): Promise<FetchedShape> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', 'json');

  const taggerResp = await fetch(url, { method: 'POST', body: formData });
  const raw = (await taggerResp.json()) as AutoTaggerShape;
  if (!taggerResp.ok) { return { matches: [], nonMatched: [] } };

  const predicted = normalizeResponse(raw);
    if (predicted.length === 0) {
      return { matches: [], nonMatched: [] };
    }

    // Fast lookups
    const scoreByLowerName = new Map<string, number>();
    for (const p of predicted) scoreByLowerName.set(p.name.toLowerCase(), p.score);

    const names = Array.from(new Set(predicted.map((p) => p.name).filter(Boolean)));

    // 4) Delegate to resolver for canonical tag objects
    const resolveResp = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/tags/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    });

    const resolved = await resolveResp.json();
    if (!resolveResp.ok) { return { matches: [], nonMatched: [] } };
    const resolvedTags = Array.isArray(resolved) ? resolved : [];

    // 5) Attach prediction scores to matches
    // For each resolved tag, find the best score among:
    //   - its canonical name
    //   - any of its aliases
    // We also return which name actually matched (matchedName).
    const matches = resolvedTags.map((tag: any) => {
      const candidates: string[] = [
        String(tag?.name || ''),
        ...(Array.isArray(tag?.aliases) ? tag.aliases.map((a: any) => String(a.alias || '')) : []),
      ].filter(Boolean);

      let bestScore = -Infinity;
      let matchedName = '';
      for (const c of candidates) {
        const s = scoreByLowerName.get(c.toLowerCase());
        if (typeof s === 'number' && s > bestScore) {
          bestScore = s;
          matchedName = c;
        }
      }
      // If none matched (shouldn’t happen, but guard anyway), set to 0
      if (!Number.isFinite(bestScore)) bestScore = 0;

      return { tag, score: bestScore, matchedName };
    });

    matches.sort((a, b) => b.score - a.score);

    // 6) Compute nonMatched (with scores) by excluding anything that matched via name or alias
    const matchedNameSet = new Set<string>(
      matches
        .map((m) => m.matchedName.toLowerCase())
        .filter(Boolean)
    );

    const nonMatched = predicted.filter((p) => !matchedNameSet.has(p.name.toLowerCase()));
    nonMatched.sort((a, b) => b.score - a.score);

    return { matches, nonMatched };
}