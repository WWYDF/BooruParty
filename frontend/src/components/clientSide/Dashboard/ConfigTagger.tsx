'use client';

import { AutotagMode } from '@/core/types/dashboard';
import AddonSectionCard from './SectionCard';
import { Robot, Circle, LinkSimple } from '@phosphor-icons/react';
import { CheckCircle } from 'phosphor-react';
import ChoiceTiles, { ChoiceTileOption } from './ChoiceTiles';
import SwitchIOS from '../SwitchIOS';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-zinc-300">{children}</label>;
}

const modeOptions: ChoiceTileOption<AutotagMode>[] = [
  {
    value: 'PASSIVE',
    label: 'Passive',
    desc: 'Show received tags as suggestions in the editor; user chooses which tags to apply.',
  },
  {
    value: 'AGGRESSIVE',
    label: 'Aggressive',
    desc: 'Always apply received tags automatically on upload.',
  },
  {
    value: 'SELECTIVE',
    label: 'Selective',
    desc: 'Users can apply received tags to their upload batch if they decide to. (Requires Permission)',
  },
];

export default function AutoTaggerSection({
  enabled,
  url,
  mode,
  onToggle,
  onChangeUrl,
  onChangeMode,
  urlInvalid,
}: {
  enabled: boolean;
  url: string;
  mode: AutotagMode[];
  onToggle: () => void;
  onChangeUrl: (v: string) => void;
  onChangeMode: (v: AutotagMode[]) => void;
  urlInvalid?: boolean;
}) {
  return (
    <AddonSectionCard
      icon={<Robot size={24} weight="duotone" />}
      title="Automatic Tagging"
      subtitle="Connect to a WD14 autotagger server and choose how it applies tags."
      enabled={enabled}
      onToggle={onToggle}
    >
      <div className="space-y-5">
        {/* URL */}
        <div className="space-y-2">
          <FieldLabel>Autotagger URL</FieldLabel>
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-2.5 py-2">
              <LinkSimple size={18} className="text-zinc-400" />
            </span>
            <div className="flex-1">
              <input
                type="url"
                value={url}
                onChange={(e) => onChangeUrl(e.target.value)}
                placeholder="http://127.0.0.1:7860"
                required={enabled}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-zinc-600"
              />
              {urlInvalid && (
                <p className="mt-1 text-xs text-red-400">
                  Please enter a valid http(s) URL.
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            This is the root endpoint your server will send images to for evaluation. (No trailing slash)
          </p>
        </div>

        {/* Mode */}
        <div className="space-y-2">
          <FieldLabel>Mode</FieldLabel>
          <ChoiceTiles
            value={mode}
            onChange={onChangeMode}
            options={modeOptions}
            multiple
          />
        </div>
      </div>
    </AddonSectionCard>
  );
}
