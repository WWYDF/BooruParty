import { TagSummary, tagSummarySelect } from "@/core/objects/selects/summaries";
import { Db, prisma } from "@/core/plugins/prisma";
import { getServerAddons } from "@/core/utilities/addonsCache";
import { normalizeTagName } from "@/core/utilities/tags";
import { Client, handle_file } from "@gradio/client";

const model_repo = 'SmilingWolf/wd-swinv2-tagger-v3';
const general_thresh = 0.35;
const character_thresh = 0.85;

export type PredictedTag = { name: string, score: number };

// Shapes from the space's /gradio_api/info schema (Gradio "Label" component).
type LabelConfidence = { label: string | number | null; confidence: number | null };
type LabelData = { label: string | number | null; confidences: LabelConfidence[] | null };

// /predict outputs, in order: tag string, rating, characters, general tags.
type PredictOutput = [tags: string, rating: LabelData, characters: LabelData, general: LabelData];


// WD-14 /predict returns [string, rating, characters, general].
// Flatten them, drop ratings, keep the best score per name, and sort high to low
export function normalizePredictions(data: PredictOutput): PredictedTag[] {
  const [, , characters, general] = data;

  const best = new Map<string, number>();
  for (const output of [characters, general]) {
    for (const c of output.confidences ?? []) {
      const label = String(c.label ?? '').trim().toLowerCase();
      const score = c.confidence ?? NaN;
      if (!label || !Number.isFinite(score)) continue;

      if (score > (best.get(label) ?? -1)) best.set(label, score);
    }
  }

  return [...best]
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}

// Sends an image to the configured WD-14 Gradio API and returns its predictions (best first)
// Returns [] if the addon is disabled, and throws if the API is unreachable
export async function predictTags(image: Blob): Promise<PredictedTag[]> {
  const { enableAutoTagger, autoTaggerUrl } = getServerAddons();
  if (!enableAutoTagger || !autoTaggerUrl) return [];

  const client = await Client.connect(autoTaggerUrl);
  const result = await client.predict('/predict', {
    image: handle_file(image),
    model_repo,
    general_thresh,
    general_mcut_enabled: false,
    character_thresh,
    character_mcut_enabled: false,
  });

  return normalizePredictions(result.data as PredictOutput);
}

////////////////////////////////////////////////////////////////////////////////////
// dividing things here cause these are pretty separate groups of functions

export type AutoTagMatch = { tag: TagSummary, score: number, matchedName: string };

export type AutoTagResult = {
  matches: AutoTagMatch[],  // existing tags, best score first, one entry per tag
  missing: PredictedTag[],  // valid names with no matching tags yet
}

// Splits predictions into tags that already exist and names that dont
// Names that fail normalization are dropped since they are invalid
export async function matchPredictions(predicted: PredictedTag[], db: Db = prisma): Promise<AutoTagResult> {
  // Normalize first. Two predictions can normalize to the same name, so keep the best score
  const scoreByName = new Map<string, number>();
  for (const p of predicted) {
    const result = normalizeTagName(p.name);
    if (!result.ok) continue;
    if (p.score > (scoreByName.get(result.name) ?? -1)) scoreByName.set(result.name, p.score);
  }
  if (scoreByName.size === 0) return { matches: [], missing: [] };

  const rows = await db.tagName.findMany({
    where: { name: { in: [...scoreByName.keys()] } },
    select: { name: true, tag: { select: tagSummarySelect } },
  });

  // A tag's name and its alias can both be predicted ("cat_ears" + "nekomimi")
  // in this event, keep the one with the better score
  const byTag = new Map<number, AutoTagMatch>();
  for (const row of rows) {
    const score = scoreByName.get(row.name)!;
    const prev = byTag.get(row.tag.id);
    if (!prev || score > prev.score) byTag.set(row.tag.id, { tag: row.tag, score, matchedName: row.name });
  }

  const matched = new Set(rows.map((r) => r.name));
  const missing = [...scoreByName]
    .filter(([name]) => !matched.has(name))
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
  
  const matches = [...byTag.values()].sort((a, b) => b.score - a.score);
  return { matches, missing };
}