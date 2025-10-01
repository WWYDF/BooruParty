'use client';

import { AutotagMode } from '@/core/types/dashboard';
import AddonSectionCard from './SectionCard';
import { Robot, Circle, LinkSimple } from '@phosphor-icons/react';
import { CheckCircle } from 'phosphor-react';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-zinc-300">{children}</label>;
}

function ModeChoice({
  value,
  onChange,
}: {
  value: AutotagMode;
  onChange: (v: AutotagMode) => void;
}) {
  const Option = ({
    label,
    desc,
    chosen,
    onClick,
  }: {
    label: string;
    desc: string;
    chosen: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition
        ${chosen
          ? 'border-emerald-600 bg-emerald-600/10'
          : 'border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/60'
        }`}
      aria-pressed={chosen}
    >
      <div className="flex items-center justify-between">
        <div className="text-zinc-100 font-semibold">{label}</div>
        {chosen ? (
          <CheckCircle size={20} weight="fill" className="text-emerald-400" />
        ) : (
          <Circle size={20} weight="regular" className="text-zinc-500" />
        )}
      </div>
      <div className={`mt-1 text-sm ${chosen ? 'text-emerald-300' : 'text-zinc-400'}`}>
        {desc}
      </div>
    </button>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Option
        label="Passive"
        desc="Show received tags as suggestions in the editor; user chooses which tags to apply."
        chosen={value === 'PASSIVE'}
        onClick={() => onChange('PASSIVE')}
      />
      <Option
        label="Aggressive"
        desc="Always apply received tags automatically on upload."
        chosen={value === 'AGGRESSIVE'}
        onClick={() => onChange('AGGRESSIVE')}
      />
    </div>
  );
}

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
  mode: AutotagMode;
  onToggle: () => void;
  onChangeUrl: (v: string) => void;
  onChangeMode: (v: AutotagMode) => void;
  urlInvalid?: boolean;
}) {
  return (
    <AddonSectionCard
      icon={<Robot size={24} weight="duotone" />}
      title="Automatic Tagging"
      subtitle="Connect to danbooru autotagger server and choose how it applies tags."
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
                placeholder="http://192.168.1.50:5000/evaluate"
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
            This is the endpoint your server will POST images to. (Example: <code>/evaluate</code>)
          </p>
        </div>

        {/* Mode */}
        <div className="space-y-2">
          <FieldLabel>Mode</FieldLabel>
          <ModeChoice value={mode} onChange={onChangeMode} />
        </div>
      </div>
    </AddonSectionCard>
  );
}
