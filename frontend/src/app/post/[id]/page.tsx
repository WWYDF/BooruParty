import { Metadata } from "next";
import PostView from "@/components/Posts/Individual/PostView";
import { formatStorageFromBytes } from "@/core/formats";
import { PostDetail } from "@/core/types/posts";
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
  const [post, categories] = await Promise.all([
    fetchPublic<PostDetail>(`/api/posts/${id}`, 60),
    fetchPublic<{ id: number; name: string }[]>(`/api/tag-categories`, 3600),
  ]);

  // Missing, hidden by guestSafety, or guest access is off: all look the same to a guest
  if (!post) {
    return {
      title: `Post #${id}`,
      description: 'Log in to view this post.',
      openGraph: { images: [{ url: '/i/private.png', width: 500, height: 500 }] },
    };
  }

  const artistCategory = categories?.find((c) => /^artists?$/i.test(c.name));
  const artist = artistCategory && post.tags.find((t) => t.categoryId === artistCategory.id);
  const by = artist ? ` by ${artist.name}` : '';

  return {
    title: `Post #${post.id}${by}`,
    description: `View this ${formatStorageFromBytes(post.fileSize)} ${post.type.toLowerCase()}${by}.`,
    openGraph: { images: [{ url: post.thumbnails.large }] },
  };
}

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ pool?: string }>;
}) {
  const { id } = await params;
  const pool = (await searchParams)?.pool;

  return <PostView postId={Number(id)} poolId={pool ? Number(pool) : undefined} />;
}
