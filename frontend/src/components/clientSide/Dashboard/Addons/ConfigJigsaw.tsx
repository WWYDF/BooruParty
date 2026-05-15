'use client';

import { useState, useEffect } from 'react';
import AddonSectionCard from './SectionCard';
import { PuzzlePieceIcon } from '@phosphor-icons/react';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-zinc-300">{children}</label>;
}

export default function JigsawSection({
  enabled,
  vagueTagName,
  onToggle,
  onChangeVagueTagName,
}: {
  enabled: boolean;
  vagueTagName: string[];
  onToggle: () => void;
  onChangeVagueTagName: (v: string[]) => void;
}) {
  // Local state for the input value
  const [inputValue, setInputValue] = useState(vagueTagName.join(', '));

  // Sync with prop changes
  useEffect(() => {
    setInputValue(vagueTagName.join(', '));
  }, [vagueTagName]);

  const handleBlur = () => {
    // Only parse when user finishes editing
    const tags = inputValue
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    onChangeVagueTagName(tags);
  };

  return (
    <AddonSectionCard
      icon={<PuzzlePieceIcon size={24} weight="duotone" />}
      title="Jigsaw"
      subtitle="Play fun, randomly generated Jigsaw puzzles based on your Posts."
      enabled={enabled}
      onToggle={onToggle}
    >
      <div className="space-y-5">
        {/* Vague Tag Names */}
        <div className="space-y-2">
          <FieldLabel>Vague Tag Names</FieldLabel>
          <div className="flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleBlur}
              placeholder="simple_background, comic, variation"
              required={enabled}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-zinc-600"
            />
          </div>
          <p className="text-xs text-zinc-500">
            Posts tagged with any of these will be excluded from random post selection if enabled. Separate multiple tags with commas.
          </p>
          <p className="text-xs text-amber-400/90">
            ⚠️ Tag aliases are not supported. Use actual tag names only.
          </p>
        </div>
      </div>
    </AddonSectionCard>
  );
}