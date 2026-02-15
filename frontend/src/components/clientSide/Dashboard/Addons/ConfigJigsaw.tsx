'use client';

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
  vagueTagName: string;
  onToggle: () => void;
  onChangeVagueTagName: (v: string) => void;
}) {
  return (
    <AddonSectionCard
      icon={<PuzzlePieceIcon size={24} weight="duotone" />}
      title="Jigsaw"
      subtitle="Play fun, randomly generated Jigsaw puzzles based on your Posts."
      enabled={enabled}
      onToggle={onToggle}
    >
      <div className="space-y-5">
        {/* Vague Tag Name */}
        <div className="space-y-2">
          <FieldLabel>Vague Tag Name</FieldLabel>
          <div className="flex-1">
            <input
              type="text"
              value={vagueTagName}
              onChange={(e) => onChangeVagueTagName(e.target.value)}
              placeholder="simple_background"
              required={enabled}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-zinc-600"
            />
          </div>
          <p className="text-xs text-zinc-500">
            Posts tagged with this will be excluded from random post selection if enabled.
          </p>
          <p className="text-xs text-amber-400/90">
            ⚠️ Tag aliases are not supported. Use the actual tag name only.
          </p>
        </div>
      </div>
    </AddonSectionCard>
  );
}