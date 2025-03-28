import { Suspense } from "react";
import PostGrid from "@/components/clientSide/Posts/PostGrid";
import SearchBar from "@/components/clientSide/Posts/SearchBar";
import Filters from "@/components/clientSide/Posts/Filters";
import { prisma } from "@/core/prisma";
import { auth } from "@/core/auth";

export default async function PostsPage() {
  const session = await auth();

  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { preferences: true },
      })
    : null;

  const viewMode = user?.preferences?.layout || "GRID";

  const posts = await prisma.posts.findMany({
    orderBy: { createdAt: "desc" },
    // include other stuff you use
  });

  return (
    <main className="p-4 space-y-4">
      <section className="flex flex-col md:flex-row gap-4">
        <SearchBar />
        <Filters />
      </section>

      <Suspense fallback={<p className="text-subtle">Loading posts...</p>}>
        <PostGrid />
      </Suspense>
    </main>
  );
}
