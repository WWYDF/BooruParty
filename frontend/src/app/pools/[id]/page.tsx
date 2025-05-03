import { PoolCard } from "@/components/clientSide/Pools/PoolCard";

type PoolItem = {
  id: number;
  index: number;
  notes: string | null;
  post: {
    id: number;
    previewPath: string;
    safety: "SAFE" | "UNSAFE" | "SKETCHY";
    score: number;
    aspectRatio: number | null;
    uploadedById: string;
    createdAt: string;
    _count: {
      favoritedBy: number;
    };
  };
};

type Pool = {
  id: number;
  name: string;
  artist: string | null;
  description: string | null;
  lastEdited: string;
  createdAt: string;
  _count: {
    items: number;
  };
  items: PoolItem[];
};

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pools/${id}`, {
    cache: "no-store"
  });

  if (!res.ok) return <div className="p-4">Pool not found.</div>;

  const pool: Pool = await res.json();

  return (
    <main className="max-w-1/4 mx-auto px-2 sm:px-4 py-4 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      {/* Sidebar */}
      <aside className="text-xs text-muted pr-1">
        <h1 className="text-lg font-semibold text-white mb-1">{pool.name}</h1>
        <div className="mb-1">
          <span className="text-muted">Artist:</span> {pool.artist || "Unknown"}
        </div>
        <div className="mb-1">
          <span className="text-muted">Posts:</span> {pool._count.items}
        </div>
        <div className="mb-1">
          <span className="text-muted">Created:</span>{" "}
          {new Date(pool.createdAt).toLocaleDateString()}
        </div>
        {pool.description && (
          <div className="mt-3 text-subtle whitespace-pre-wrap">{pool.description}</div>
        )}
      </aside>

      {/* Grid of posts */}
      <section className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {pool.items.map((item) => (
          <PoolCard
            key={item.id}
            id={item.post.id}
            name={`#${item.index + 1}`}
            artist={null}
            coverUrl={item.post.previewPath}
            safety={item.post.safety}
            showOverlay={false}
            linkTo={`/posts/${item.post.id}`}
          />
        ))}
      </section>
    </main>
  );
}
