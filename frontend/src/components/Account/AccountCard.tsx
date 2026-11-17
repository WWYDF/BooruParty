export const inputClass =
  "w-full rounded-lg border border-secondary-border bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-hidden focus:ring-1 focus:ring-zinc-600 disabled:cursor-not-allowed disabled:opacity-50";

export function AccountCard({ title, description, badge, danger, children }: {
  title: string;
  description?: string;
  badge?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border p-5 ${danger ? "border-red-900/60 bg-red-950/10" : "border-secondary-border bg-zinc-900/40"}`}>
      <div className="flex items-center gap-2">
        <h2 className={`text-sm font-medium ${danger ? "text-red-300" : "text-zinc-200"}`}>{title}</h2>
        {badge && <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-2xs text-subtle">{badge}</span>}
      </div>
      {description && <p className="mt-0.5 text-xs text-subtle">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-600">{hint}</span>}
    </label>
  );
}

// Right-aligned save row at the bottom of a card
export function CardActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 flex justify-end gap-2">{children}</div>;
}
