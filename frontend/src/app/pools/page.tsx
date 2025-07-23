import { ClientPoolGrid } from "@/components/clientSide/Pools/PoolGrid";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { Metadata } from 'next';
import { prisma } from "@/core/prisma";
export const dynamic = 'force-dynamic';

const site_name = process.env.NEXT_PUBLIC_SITE_NAME || 'https://example.com'
const totalPools = await prisma.pools.count();

export const metadata: Metadata = {
  title: {
    default: `Pools`,
    template: `%s | ${site_name}`
  },
  description: `Dive into ${totalPools} pools on ${site_name}.`,
  icons: { // Favicon
   icon: '/i/party.png'
  },
  openGraph: {  // The preview image for Discord, Twitter, etc.
    images: []
  },
}

export default async function PoolsPage() {
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
      <ClientPoolGrid />
    </div>
  );
}
