import { ClientPoolGrid } from "@/components/clientSide/Pools/PoolGrid";

export default async function PoolsPage() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pools`);
  const { pools } = await res.json();

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <ClientPoolGrid pools={pools} />
    </div>
  );
}
