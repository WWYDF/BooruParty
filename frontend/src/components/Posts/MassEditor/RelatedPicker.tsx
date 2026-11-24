import { RelateMode } from '@/core/types/posts';
import Section from './Section';
import { inputClass } from './shared';

type Props = {
  mode: RelateMode;
  onMode: (mode: RelateMode) => void;
  target: string; // post id typed for "one" mode (validated by the form)
  onTarget: (target: string) => void;
  maxEachOther: number; // "each other" is disabled above this many selected posts
  selectedCount: number;
};

export default function RelatedPicker({ mode, onMode, target, onTarget, maxEachOther, selectedCount }: Props) {
  const tooMany = selectedCount > maxEachOther;

  return (
    <Section title="Related posts" hint="Adds links only. Existing related posts are kept.">
      <div className="space-y-1.5 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" name="relate" checked={mode === 'none'} onChange={() => onMode('none')} className="cursor-pointer" />
          Leave unchanged
        </label>

        <label className="flex cursor-pointer flex-wrap items-center gap-2">
          <input type="radio" name="relate" checked={mode === 'one'} onChange={() => onMode('one')} className="cursor-pointer" />
          Relate every selected post to post #
          <input
            type="text"
            inputMode="numeric"
            value={target}
            onChange={(e) => { onTarget(e.target.value); onMode('one'); }}
            placeholder="id"
            className={`w-24 py-0.5! ${inputClass}`}
          />
        </label>

        <label className={`flex items-center gap-2 ${tooMany ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
          <input
            type="radio"
            name="relate"
            checked={mode === 'all'}
            disabled={tooMany}
            onChange={() => onMode('all')}
            className="cursor-pointer disabled:cursor-not-allowed"
          />
          Relate the selected posts to each other
          {tooMany && <span className="text-xs text-subtle">(at most {maxEachOther} posts)</span>}
        </label>
      </div>
    </Section>
  );
}
