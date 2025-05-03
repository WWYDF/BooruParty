import { PoolCard } from "@/components/clientSide/Pools/PoolCard";
import Link from "next/link";

type Pool = {
  id: number;
  name: string;
  artist?: string | null;
  safety: 'SAFE' | 'UNSAFE' | 'SKETCHY';
  _count: { items: number };
  items: {
    post: {
      previewPath: string;
    };
  }[];
};

export default async function PoolsPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const prams = await searchParams;
  const page = parseInt(prams.page || "1");
  const query = prams.search || "";

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/pools?search=${encodeURIComponent(query)}&page=${page}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return <div className="p-6 text-red-500">Failed to load pools.</div>;
  }

  const { pools }: { pools: Pool[] } = await res.json();

  return (
    <main className="max-w-screen-xl mx-auto px-3 sm:px-4 py-4">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <form method="GET" className="flex w-full max-w-sm">
          <input
            type="text"
            name="search"
            defaultValue={query}
            placeholder="Search pools..."
            className="w-full px-4 py-2 rounded-md bg-secondary text-subtle border border-secondary-border"
          />
        </form>
        <Link
          href="/pools/create"
          className="ml-4 px-4 py-2 rounded-md bg-accent text-white hover:bg-accent/90"
        >
          + Add Pool
        </Link>
      </div>

      {/* Pool Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {pools.length > 0 ? (
          pools.map((pool) => (
            <PoolCard
              key={pool.id}
              id={pool.id}
              name={pool.name}
              artist={pool.artist ?? "Unknown"}
              coverUrl={pool.items?.[0]?.post?.previewPath}
              safety={pool.safety}
              linkTo={`/pools/${pool.id}`}
            />
          ))
        ) : (
          <div className="col-span-full text-center text-subtle text-sm mt-10">
            No pools found.
          </div>
        )}
      </div>
    </main>
  );
}
