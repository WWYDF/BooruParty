import { prisma } from "@/core/prisma";
import { auth } from "@/core/authServer";
import ClientPostsPage from "@/components/clientSide/Posts/PostsPage";
import BackToTop from "@/components/clientSide/BackToTop";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { Metadata } from "next";

const site_name = process.env.NEXT_PUBLIC_SITE_NAME || 'https://example.com'
const totalPosts = await prisma.posts.count();

export const metadata: Metadata = {
  title: {
    default: `All Posts`,
    template: `%s | ${site_name}`
  },
  description: `Explore ${totalPosts} posts shared on ${site_name}.`,
  icons: { // Favicon
   icon: '/i/party.png'
  },
  openGraph: {  // The preview image for Discord, Twitter, etc.
    images: []
  },
}

export default async function PostsPage() {
  const session = await auth();

  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          preferences: true,
          role: {
            select: {
              permissions: true
            }
          }
        },
      })
    : null;

  const postsPerPage = user?.preferences?.postsPerPage ?? 50; // fallback default

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

  const initialPosts = await prisma.posts.findMany({
    orderBy: { createdAt: "desc" },
    take: postsPerPage, // Limit page 1 properly
    include: {
      comments: {
        select: {
          authorId: true,
          content: true,
        },
      },
      _count: {
        select: {
          favoritedBy: true
        }
      }
    }
  });

  return (
    <main className="p-4 space-y-4">
      <ClientPostsPage
        initialPosts={initialPosts}
        postsPerPage={postsPerPage} // Pass it to client
      />
      <BackToTop />
    </main>
  );
}
