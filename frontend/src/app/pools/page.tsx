import { ClientPoolGrid } from "@/components/clientSide/Pools/PoolGrid";
import { checkPermissions } from "@/components/serverSide/permCheck";
export const dynamic = 'force-dynamic';

export default async function PoolsPage() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pools`);
  const { pools } = await res.json();

  if (process.env.GUEST_VIEWING === 'false') {
    const permCheck = (await checkPermissions(['post_view']))['post_view'];
  
    if (!permCheck) {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center text-center px-4 text-red-400">
          <h1 className="text-3xl font-bold mb-2">Unauthorized</h1>
          <p className="text-base text-subtle max-w-md">Guests do not have permission to view posts.</p>
          <p className="text-base text-subtle max-w-md">
            Please click <a className="text-accent hover:underline" href="/login">here</a> to login.
          </p>
        </main>
      );
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <ClientPoolGrid pools={pools} />
    </div>
  );
}
