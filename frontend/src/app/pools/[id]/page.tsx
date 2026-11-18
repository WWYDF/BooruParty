import { Metadata } from "next";
import ClientPoolPage from "@/components/Pools/Individual/ClientPoolPage";
import { PoolDetail } from "@/core/types/pools";
import { API_Endpoint } from "@/core/api";

// No cookies on purpose: this is what a guest (or Discord's embed bot) is allowed to see
async function fetchPublic<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${API_Endpoint}${path}`, { next: { revalidate } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pool = await fetchPublic<PoolDetail>(`/api/pools/${id}`, 60);

  // Missing, nothing a guest may see, or guest access is off: all look the same
  if (!pool) {
    return {
      title: `Pool #${id}`,
      description: 'Log in to view this pool.',
      openGraph: { images: [{ url: '/i/private.png', width: 500, height: 500 }] },
    };
  }

  const artist = pool.artists[0]?.name;
  const years = pool.yearStart
    ? `Years: ${pool.yearStart} - ${pool.yearEnd ?? 'Present'} (${pool.yearEnd ? 'Ended' : 'Ongoing'})`
    : '';

  const description = [
    artist ? `Artist: ${artist}` : '',
    `Pages: ${pool.posts.length}`,
    `Favorites: ${pool.favoriteCount}`,
    years,
  ].filter(Boolean).join('\n');

  const cover = pool.posts[0]?.thumbnails.large;

  return {
    title: artist ? `${pool.name} by ${artist}` : pool.name,
    description,
    openGraph: { images: cover ? [{ url: cover }] : [] },
  };
}

export default async function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientPoolPage poolId={Number(id)} />;
}
