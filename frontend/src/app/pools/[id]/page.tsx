import ClientPoolPage from "@/components/clientSide/Pools/Individual/ClientPoolPage";
import { Metadata } from "next";
import { cookies } from "next/headers";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const prams = await params;
  const site_name = process.env.NEXT_PUBLIC_SITE_NAME || 'https://example.com'
  return {
    title: {
      default: `Pool #${prams.id}`,
      template: `%s | ${site_name}`
    },
    icons: { // Favicon
     icon: '/i/party.png'
    },
    openGraph: {  // The preview image for Discord, Twitter, etc.
      images: []
    },
  }
}

export default async function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookie = (await cookies()).toString();
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pools/${id}`, {
    cache: "no-store",
    headers: {
      cookie,
    }
  });

  if (!res.ok) {
    return <div className="p-4 text-red-500">Failed to load pool.</div>;
  }

  const pool = await res.json();

  let status = '';
  if (pool.yearStart !== null) {
    const yearRange = pool.yearEnd ? `${pool.yearStart} - ${pool.yearEnd}` : `${pool.yearStart} - Present`;
    const state = pool.yearEnd ? 'Ended' : 'Ongoing';
    status = `Status: ${state}\nYears: ${yearRange}`;
  }

  const desc = [
    `Artist: ${pool.artist}`,
    `Pages: ${pool._count.items}`,
    `Score: ${pool.score}`,
    status, // will be empty if yearStart is null
  ].filter(Boolean).join('\n');

  return (
    <main>
      <meta name="description" content={desc} />
      <meta property="og:title" content={`'${pool.name}' | ${process.env.NEXT_PUBLIC_SITE_NAME}`} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={pool.items[0].post.previewPath} />
      <ClientPoolPage pool={pool} />
    </main>
  )
}