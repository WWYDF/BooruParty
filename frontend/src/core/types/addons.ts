export type AutoTaggerMode = 'PASSIVE' | 'AGGRESSIVE' | 'SELECTIVE';

// GET /api/system/addons (autoTaggerUrl only comes back for viewers with dashboard.addons)
// PATCH returns the same shape, always with the URL
export type AddonsState = {
  enableAutoTagger: boolean,
  autoTaggerMode: AutoTaggerMode[],
  autoTaggerUrl?: string | null,
};

// POST /api/posts/:id/autotag
export type AutoTagMatch = {
  tag: { id: number, name: string, categoryId: number, postCount: number },
  score: number,       // 0..1
  matchedName: string, // the name or alias that was predicted
};

export type AutoTagResult = {
  matches: AutoTagMatch[],                  // existing tags, best first
  missing: { name: string, score: number }[], // predicted names with no tag yet
};
