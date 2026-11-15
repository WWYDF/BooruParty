import ClientPostsPage from "@/components/Posts/PostsPage";
import BackToTop from "@/components/Navigation/BackToTop";
import { Metadata } from "next";
import { Suspense } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";

const site_name = process.env.NEXT_PUBLIC_SITE_NAME || 'https://example.com'

export async function generateMetadata(): Promise<Metadata> {
  const fallback = `Explore posts shared on ${site_name}.`;

  // No auth required, and server side only, so the API helper is pointless here lol
  const description = await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/system/stats`, {
    next: { revalidate: 300 },
  })
    .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
    .then((stats) => (stats.postCount ? `Explore ${stats.postCount} posts shared on ${site_name}.` : fallback))
    .catch(() => fallback);

  return { title: 'All Posts', description };
}

export default async function PostsPage() {
  return (
    <main className="p-4 space-y-4">
      <Suspense fallback={<LoadingOverlay show label='Loading Posts...' />}>
        <ClientPostsPage />
      </Suspense>
      <BackToTop />
    </main>
  );
}
