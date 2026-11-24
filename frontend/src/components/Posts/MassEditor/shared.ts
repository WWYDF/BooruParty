import { useToast } from '@/components/UI/Toast';
import { BulkResult } from '@/core/types/posts';

export const plural = (n: number) => `${n} post${n === 1 ? '' : 's'}`;

export const inputClass = 'rounded-lg border border-secondary-border bg-zinc-900 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-600';

// One toast for every /api/posts/bulk route: "Liked 12 posts (3 skipped: ...)"
export function reportBulk(toast: ReturnType<typeof useToast>, verb: string, result: BulkResult) {
  const skipped = result.skipped.length ? ` (${result.skipped.length} skipped: hidden, missing, or not yours)` : '';
  if (result.updated.length === 0) toast(`No posts changed${skipped}`, 'error');
  else toast(`${verb} ${plural(result.updated.length)}${skipped}`, 'success');
}
