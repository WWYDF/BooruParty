import ClientPoolPage from "@/components/clientSide/Pools/Individual/ClientPoolPage";

type Props = {
  params: { id: string };
};

export default async function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pools/${id}`, {
    cache: "no-store"
  });

  if (!res.ok) {
    return <div className="p-4 text-red-500">Failed to load pool.</div>;
  }

  const pool = await res.json();

  return <ClientPoolPage pool={pool} />;
}