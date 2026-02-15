'use client';

import AddonSectionCard from './SectionCard';
import { PaintBrushBroad } from '@phosphor-icons/react';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-zinc-300">{children}</label>;
}

export default function ArtistProfileSection({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <AddonSectionCard
      icon={<PaintBrushBroad size={24} weight="duotone" />}
      title="Artist Profiles"
      subtitle="lorem ipsum."
      enabled={enabled}
      onToggle={onToggle}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 opacity-60">
          <FieldLabel>Option 1</FieldLabel>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-500">
            (placeholder)
          </div>
        </div>
        <div className="space-y-1.5 opacity-60">
          <FieldLabel>Opition 2</FieldLabel>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-500">
            (placeholder)
          </div>
        </div>
      </div>
    </AddonSectionCard>
  );
}
