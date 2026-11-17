import { ReactNode } from "react";
import { HourglassMediumIcon } from "@phosphor-icons/react/dist/ssr";

type Props = {
  title: string;
  description: string;
  planned?: string[]; // what the section will do, so it's clear what's missing
  icon?: ReactNode;
};

// Placeholder for dashboard sections whose API doesn't exist yet (rework in progress)
export default function ComingSoon({ title, description, planned, icon }: Props) {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary-border bg-zinc-900 text-accent">
        {icon ?? <HourglassMediumIcon size={28} />}
      </div>
      <h1 className="text-2xl font-semibold text-zinc-100">{title}</h1>
      <p className="mt-2 text-sm text-subtle">{description}</p>

      {planned && planned.length > 0 && (
        <div className="mt-6 rounded-xl border border-secondary-border bg-zinc-900/40 px-5 py-4 text-left">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle">Planned</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {planned.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}

      <span className="mt-6 inline-block rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent">
        Coming soon
      </span>
    </div>
  );
}
