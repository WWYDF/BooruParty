import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { checkPermissions } from '@/components/serverSide/permCheck';
import type { AutoTaggerShape } from '@/core/types/dashboard';
import { normalizeResponse } from '@/components/serverSide/UploadProcessing/autotagger';
import { Client } from '@gradio/client';

export type PredictTag = { name: string; score: number };

function getBaseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
}

function toTagKey(label: string): string {
  return String(label).trim().toLowerCase().replace(/[\s\-]+/g, '_').replace(/_+/g, '_');
}

/** Build the API's "raw" payload from wd-14 shape, discarding ratings entirely */
function buildApiRawFromWd14(raw: AutoTaggerShape) {
  const ratingDrop = new Set(['general', 'sensitive', 'questionable', 'explicit']);
  const tags: Record<string, number> = {};

  for (const item of Array.isArray(raw) ? raw : []) {
    for (const c of Array.isArray(item?.confidences) ? item.confidences : []) {
      const lbl = String(c?.label ?? '').trim();
      if (!lbl || ratingDrop.has(lbl)) continue;
      const key = toTagKey(lbl);
      const conf = Number(c?.confidence ?? 0) || 0;
      const prev = tags[key];
      if (prev === undefined || conf > prev) tags[key] = conf;
    }
  }

  return [{ filename: 'preview', tags }];
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
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });

    // Load configured autotagger URL
    const cfg = await prisma.addonsConfig.findUnique({ where: { id: 1 } });
    if (!cfg?.autoTagger || !cfg.autoTaggerUrl) {
      return NextResponse.json({ error: 'Autotagger disabled' }, { status: 400 });
    }

    // fetch image
    const imgRes = await fetch(imageUrl, { redirect: 'follow', cache: 'no-store' });
    if (!imgRes.ok) return NextResponse.json({ error: `image fetch ${imgRes.status}` }, { status: 502 });
    const blob = await imgRes.blob();

    // wd-14 via Gradio
    let wd: AutoTaggerShape;
    try {
      const client = await Client.connect(cfg.autoTaggerUrl);
      wd = (await client.predict('/predict', {
        image: blob,
        model_repo: 'SmilingWolf/wd-swinv2-tagger-v3',
        general_thresh: 0,
        general_mcut_enabled: true,
        character_thresh: 0,
        character_mcut_enabled: true,
      })).data as AutoTaggerShape;
    } catch (err: any) {
      return NextResponse.json({ error: `Autotagger call failed: ${err?.message || String(err)}` }, { status: 502 });
    }

    // Build API's raw payload from wd-14
    const raw = buildApiRawFromWd14(wd);

    // Normalize for resolver
    const predicted = normalizeResponse(wd);
    if (predicted.length === 0) {
      return NextResponse.json({ raw, matches: [], nonMatched: [] });
    }

    // Resolver cross-check
    const scoreByLower = new Map<string, number>(predicted.map(p => [p.name.toLowerCase(), p.score]));
    const names = Array.from(new Set(predicted.map(p => p.name)));
    const base = getBaseUrl(req);

    const resolveResp = await fetch(`${base}/api/tags/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ names }),
    });

    let resolved: any;
    try {
      resolved = await readJsonSafe(resolveResp);
    } catch (err: any) {
      return NextResponse.json({ error: `Resolver returned non-JSON. ${err?.message || String(err)}` }, { status: 502 });
    }
    if (!resolveResp.ok) {
      return NextResponse.json({ error: resolved?.error || `resolver ${resolveResp.status}` }, { status: 502 });
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

    return NextResponse.json({ raw, matches, nonMatched });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'AutoTagger Format Failure' }, { status: 500 });
  }
}
