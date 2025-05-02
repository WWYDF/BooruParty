import PostDisplay from "@/components/clientSide/Posts/Individual/PostDisplay";
import PostMetadata from "@/components/clientSide/Posts/Individual/PostMetadata";
import PostNavigator from "@/components/clientSide/Posts/Individual/PostNavigator";
import PostCommentForm from "@/components/clientSide/Posts/Individual/PostCommentForm";
import PostCommentList from "@/components/clientSide/Posts/Individual/PostCommentList";
import { Comments } from "@/core/types/comments";
import { cookies } from "next/headers";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/auth";

async function fetchPostData(postId: string) {
  const cookieStore = cookies();
  const cookieHeader = (await cookieStore).getAll()
    .map((c: any) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts/${postId}`, {
    cache: "no-store",
    headers: {
      Cookie: cookieHeader,
    },
  });
  if (!res.ok) {
    const data = await res.json();
    const error = data?.error || "Failed to fetch post";
    throw new Error(error);
  }
  return res.json();
}

async function fetchComments(postId: string): Promise<Comments[]> {
  const cookieStore = cookies();
  const token = (await cookieStore).get("next-auth.session-token")?.value ??
                (await cookieStore).get("__Secure-next-auth.session-token")?.value;

  const cookieHeader = token ? `next-auth.session-token=${token}` : "";

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/comments?postId=${postId}`, {
    cache: "no-store",
    headers: {
      Cookie: cookieHeader
    }

  });
  const rawComments: Comments[] = await res.json();

  return rawComments;
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = id;
  const postPromise = fetchPostData(postId);
  const commentsPromise = fetchComments(postId);
  const canComment = await checkPermissions('comment_create');

  const [postResult, commentsResult] = await Promise.allSettled([
    postPromise,
    commentsPromise,
  ]);

  if (postResult.status !== "fulfilled") {
    const errMsg = postResult.reason?.message?.toLowerCase() ?? "";
  
    let title = "Failed to load post";
    let description = "Something went wrong while fetching the post.";
  
    if (errMsg.includes("not found") || errMsg.includes("404")) {
      title = "Post Not Found";
      description = "The post you're looking for doesn’t exist or has been removed.";
    } else if (errMsg.includes("unauthorized") || errMsg.includes("forbidden") || errMsg.includes("403")) {
      title = "Access Denied";
      description = "You do not have permission to view this post.";
    }
  
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-center px-4 text-red-400">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-base text-subtle max-w-md">{description}</p>
      </main>
    );
  }

  const postData = postResult.value;
  const comments = commentsResult.status === 'fulfilled' ? commentsResult.value : [];

  return (
    <main className="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-6 p-4">
      {/* LEFT COLUMN - Metadata */}
      <div className="order-3 md:order-1 md:col-span-1 mt-6 md:mt-0 border-r border-zinc-900">
        <PostMetadata post={postData.post} />
      </div>

      {/* RIGHT COLUMN - Main content + Comments */}
      <div className="order-1 md:order-2 space-y-6">
        <PostNavigator postId={postData.post.id} />
        <PostDisplay post={postData.post} />

        {/* Comments - In column 2 only */}
        <section className="order-4 border-t border-secondary-border pt-4 space-y-4">
          <h2 className="text-accent text-lg">Comments</h2>
          {canComment && <PostCommentForm postId={postData.post.id} />}
          <PostCommentList comments={comments} loading={false} error={null} blurUnsafeEmbeds={true} parentPostSafety={postData.post.safety} />
        </section>                                                        {/* Get from user preferences later */}
      </div>
    </main>
  );
}
