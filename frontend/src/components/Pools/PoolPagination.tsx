'use client';

type PaginationProps = {
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
};

export default function PoolPagination({ page, totalPages, setPage }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getMiddlePages = () => {
    const pages: number[] = [];

    if (page <= 3) {
      pages.push(2, 3, 4);
    } else if (page >= totalPages - 2) {
      pages.push(totalPages - 3, totalPages - 2, totalPages - 1);
    } else {
      pages.push(page - 1, page, page + 1);
    }

    return pages.filter((p) => p > 1 && p < totalPages);
  };

  const middle = getMiddlePages();

  return (
    <div className="flex justify-center gap-2 mt-6 flex-wrap">
      {[1, ...middle, totalPages].map((p, i, arr) => {
        // Avoid duplicate display of first/last
        if (i > 0 && p === arr[i - 1]) return null;

        return (
          <button
            key={p}
            onClick={() => setPage(p)}
            disabled={p === page}
            className={`px-3 py-1 rounded text-sm transition ${
              p === page
                ? 'bg-darkerAccent text-white cursor-default'
                : 'bg-zinc-800 text-white hover:bg-zinc-700'
            }`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}