import { Safety } from '@/core/types/posts';
import { SAFETY_LEVELS, SAFETY_STYLES } from '@/core/types/uploads';
import Section from './Section';

type Props = {
  value: Safety | null; // null = leave unchanged
  onChange: (safety: Safety | null) => void;
};

export default function SafetyPicker({ value, onChange }: Props) {
  const button = 'cursor-pointer rounded px-2 py-1.5 text-xs transition';
  const idle = 'bg-secondary-border text-subtle hover:text-white';

  return (
    <Section title="Safety">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange(null)} className={`${button} ${value === null ? 'bg-zinc-200 text-black' : idle}`}>
          Leave unchanged
        </button>
        {SAFETY_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={`${button} ${value === level ? SAFETY_STYLES[level].active : idle}`}
          >
            {SAFETY_STYLES[level].label}
          </button>
        ))}
      </div>
    </Section>
  );
}
