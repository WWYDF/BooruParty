import { prisma } from "@/core/prisma";
import { auth } from "@/core/auth";
import ClientPostsPage from "@/components/clientSide/Posts/PostsPage";

export default async function PostsPage() {
  const session = await auth();

  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { preferences: true },
      })
    : null;

  const postsPerPage = user?.preferences?.postsPerPage ?? 30; // fallback default

  const initialPosts = await prisma.posts.findMany({
    orderBy: { createdAt: "desc" },
    take: postsPerPage, // Limit page 1 properly
  });

  return (
    <main className="p-4 space-y-4">
      <ClientPostsPage
        initialPosts={initialPosts}
        postsPerPage={postsPerPage} // 🔥 Pass it to client
      />
    </main>
  );
}
