'use client';

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";

// Page numbers to show: 1 … (p-1) p (p+1) … last
function pageList(page: number, total: number): (number | "…")[] {
  const pages = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

const arrowClass =
  "cursor-pointer rounded-lg p-2 text-subtle transition-colors hover:bg-secondary hover:text-white disabled:cursor-not-allowed disabled:opacity-30";

// Renders nothing when there's only one page
export default function Pagination({ page, totalPages, onChange }: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-1 pb-6 text-sm">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className={arrowClass} aria-label="Previous page">
        <CaretLeftIcon size={16} />
      </button>

      {pageList(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-2 text-zinc-600">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-9 cursor-pointer rounded-lg px-2 py-1.5 tabular-nums transition-colors ${
              p === page ? "bg-accent font-semibold text-black" : "text-zinc-300 hover:bg-secondary"
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className={arrowClass} aria-label="Next page">
        <CaretRightIcon size={16} />
      </button>
    </nav>
  );
}
