import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { checkPermissions } from '@/components/serverSide/permCheck';
import type { AutoTaggerShape } from '@/core/types/dashboard';
import { Client } from '@gradio/client';
import { Tag } from '@/core/types/tags';

export type PredictTag = { name: string; score: number };

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

/** Safe JSON read for the resolver */
async function readJsonSafe(resp: Response): Promise<any> {
  const ct = resp.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await resp.text();
    const preview = text.slice(0, 512);
    throw new Error(`Expected JSON but got ${resp.status} ${resp.statusText} (${ct}). Body preview: ${preview}`);
  }
  return resp.json();
}

export async function fetchAutoTags(imageUrl?: string, file?: File): Promise<FetchedShape> {
  const session = await auth();
  const perms = await checkPermissions(['post_edit_own', 'post_edit_others']);
  const canEditOwnPost = perms['post_edit_own'];
  const canEditOtherPosts = perms['post_edit_others'];
  if (!session || (!canEditOwnPost && !canEditOtherPosts)) { return { matches: [], nonMatched: [] }; }
  if (!imageUrl && !file) return { matches: [], nonMatched: [] };

  try {
    // Load configured autotagger URL
    const cfg = await prisma.addonsConfig.findUnique({ where: { id: 1 } });
    if (!cfg?.autoTagger || !cfg.autoTaggerUrl) { return { matches: [], nonMatched: [] }; }
    let blob;

    // fetch image
    if (imageUrl) {
      const imgRes = await fetch(imageUrl, { redirect: 'follow', cache: 'no-store' });
      if (!imgRes.ok) return { matches: [], nonMatched: [] };
      blob = await imgRes.blob();
    } else if (file) { blob = file };


    // WD-14 via Gradio
    let wd: AutoTaggerShape;
    try {
      const client = await Client.connect(cfg.autoTaggerUrl);
      wd = (await client.predict('/predict', {
        image: blob,
        model_repo: 'SmilingWolf/wd-swinv2-tagger-v3',
        general_thresh: 0.35,
        general_mcut_enabled: false,
        character_thresh: 0.85,
        character_mcut_enabled: false,
      })).data as AutoTaggerShape;
    } catch (err: any) {
      console.error(`AutoTagger upstream fetch failed:`, err);
      return { matches: [], nonMatched: [] };
    }

    // Normalize for resolver
    const predicted = normalizeResponse(wd).map(p => ({
      ...p,
      name: p.name.replace(/\s+/g, '_'),
    }));
    if (predicted.length === 0) {
      return { matches: [], nonMatched: [] };
    }

    // Resolver cross-check
    const scoreByLower = new Map<string, number>(predicted.map(p => [p.name.toLowerCase(), p.score]));
    const names = Array.from(new Set(predicted.map(p => p.name)));

    const resolveResp = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/tags/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ names }),
    });

    let resolved: any;
    try {
      resolved = await readJsonSafe(resolveResp);
    } catch (err: any) {
      console.error(`Resolver returned non-JSON. ${err?.message || String(err)}`)
      return { matches: [], nonMatched: [] };
    }
    if (!resolveResp.ok) {
      console.error(`AutoTagger upstream fetch failed.`);
      return { matches: [], nonMatched: [] };
    }

    const resolvedTags = Array.isArray(resolved) ? resolved : [];
    const matches = resolvedTags.map((tag: any) => {
      const candidates: string[] = [
        String(tag?.name || ''),
        ...(Array.isArray(tag?.aliases) ? tag.aliases.map((a: any) => String(a.alias || '')) : []),
      ].filter(Boolean);

      let best = -Infinity;
      let matchedName = '';
      for (const c of candidates) {
        const s = scoreByLower.get(c.toLowerCase());
        if (typeof s === 'number' && s > best) {
          best = s;
          matchedName = c;
        }
      }
      if (!Number.isFinite(best)) best = 0;
      return { tag, score: best, matchedName };
    }).sort((a, b) => b.score - a.score);

    const matchedSet = new Set(matches.map(m => m.matchedName.toLowerCase()).filter(Boolean));
    const nonMatched = predicted.filter(p => !matchedSet.has(p.name.toLowerCase())).sort((a, b) => b.score - a.score);

    return { matches, nonMatched };
  } catch (e: any) {
    console.error(`AutoTagger format failed:`, e);
    return { matches: [], nonMatched: [] };
  }
}
