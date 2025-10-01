import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { checkPermissions } from '@/components/serverSide/permCheck';
import { AutoTaggerShape } from '@/core/types/dashboard';

export type PredictTag = {
  name: string;
  score: number;
};

function getBaseUrl(req: NextRequest) {
  // Prefer explicit env for server-to-server calls; fallback to current origin.
  return process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
}

/**
 * Convert AutoTaggerShape into a flat array of {name, score}.
 * If multiple items are present, collapse by tag name using max(score).
 */
function normalizeResponse(raw: AutoTaggerShape): PredictTag[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const maxByName = new Map<string, number>();
  for (const item of raw) {
    if (!item || !item.tags) continue;
    for (const [name, score] of Object.entries(item.tags)) {
      const n = String(name);
      const s = Number(score);
      if (!Number.isFinite(s)) continue;
      const prev = maxByName.get(n);
      if (prev === undefined || s > prev) maxByName.set(n, s);
    }
  }
  const arr: PredictTag[] = Array.from(maxByName, ([name, score]) => ({ name, score }));
  arr.sort((a, b) => b.score - a.score);
  return arr;
}


export async function POST(req: NextRequest) {
  const session = await auth();
  const perms = await checkPermissions(['post_edit_own', 'post_edit_others']);
  const canEditOwnPost = perms['post_edit_own'];
  const canEditOtherPosts = perms['post_edit_others'];
  if (!session || (!canEditOwnPost && !canEditOtherPosts)) {
    return NextResponse.json({ error: 'You are unauthorized to use this endpoint.' }, { status: 403 });
  }

  try {
    const { imageUrl } = (await req.json()) as { imageUrl: string };
    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });
    }

    // Load configured autotagger URL
    const cfg = await prisma.addonsConfig.findUnique({ where: { id: 1 } });
    if (!cfg?.autoTagger || !cfg.autoTaggerUrl) {
      return NextResponse.json({ error: 'Autotagger disabled' }, { status: 400 });
    }

    // 1) Fetch the image server-side
    const imgRes = await fetch(imageUrl, { redirect: 'follow' });
    if (!imgRes.ok) {
      return NextResponse.json({ error: `image fetch ${imgRes.status}` }, { status: 502 });
    }
    const blob = await imgRes.blob();

    // 2) Send to autotagger (multipart/form-data)
    const fd = new FormData();
    fd.append('file', new File([blob], 'preview', { type: blob.type || 'image/jpeg' }));
    fd.append('format', 'json');

    const taggerResp = await fetch(cfg.autoTaggerUrl, { method: 'POST', body: fd });
    const raw = (await taggerResp.json()) as AutoTaggerShape;
    if (!taggerResp.ok) {
      return NextResponse.json({ error: `autotagger ${taggerResp.status}`, raw }, { status: 502 });
    }

    // 3) Normalize predictions and build lookup maps
    const predicted = normalizeResponse(raw);
    if (predicted.length === 0) {
      return NextResponse.json({ raw, matches: [], nonMatched: [] });
    }

    // Fast lookups
    const scoreByLowerName = new Map<string, number>();
    for (const p of predicted) scoreByLowerName.set(p.name.toLowerCase(), p.score);

    const names = Array.from(new Set(predicted.map((p) => p.name).filter(Boolean)));
    const base = getBaseUrl(req);

    // 4) Delegate to resolver for canonical tag objects
    const resolveResp = await fetch(`${base}/api/tags/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    });

    const resolved = await resolveResp.json();
    if (!resolveResp.ok) {
      return NextResponse.json(
        { error: (resolved as any)?.error || `resolver ${resolveResp.status}` },
        { status: 502 }
      );
    }

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

    return NextResponse.json({ raw, matches, nonMatched });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'AutoTagger Format Failure' }, { status: 500 });
  }
}
