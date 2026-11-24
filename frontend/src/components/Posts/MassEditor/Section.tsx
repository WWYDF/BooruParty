import { ClockClockwiseIcon } from '@phosphor-icons/react';

type Props = {
  title: string;
  hint?: string;
  instant?: boolean;  // takes effect on click, no Apply step
  grow?: boolean;     // take the leftover height (sections holding a PickList)
  className?: string;
  children: React.ReactNode;
};

export default function Section({ title, hint, instant = false, grow = false, className = '', children }: Props) {
  return (
    <section className={`flex flex-col gap-2 ${grow ? 'min-h-0 flex-1' : ''} ${className}`}>
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium text-white">
          {title}
          {instant && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-400/15 px-2 py-0.5 text-2xs font-medium text-zinc-300">
              <ClockClockwiseIcon size={12} weight="duotone" />
              Applies Instantly
            </span>
          )}
        </h3>
        {hint && <p className="text-xs text-subtle">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
