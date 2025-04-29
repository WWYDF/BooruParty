import PostDisplay from "@/components/clientSide/Posts/Individual/PostDisplay";
import PostMetadata from "@/components/clientSide/Posts/Individual/PostMetadata";
import PostNavigator from "@/components/clientSide/Posts/Individual/PostNavigator";
import PostCommentForm from "@/components/clientSide/Posts/Individual/PostCommentForm";
import PostCommentList from "@/components/clientSide/Posts/Individual/PostCommentList";
import { RawComment, ResolvedComment } from "@/core/types/comments";

async function fetchPostData(postId: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts/${postId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch post");
  return res.json();
}

async function fetchComments(postId: string): Promise<ResolvedComment[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/comments?postId=${postId}`, {
    cache: "no-store",
  });
  const rawComments: RawComment[] = await res.json();

  const userCache: Record<string, string> = {};
  const resolved = await Promise.all(
    rawComments.map(async (comment) => {
      if (!userCache[comment.authorId]) {
        const userRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users/${comment.authorId}`);
        const userData = await userRes.json();
        userCache[comment.authorId] = userData?.username ?? "Unknown";
      }

      return {
        ...comment,
        authorName: userCache[comment.authorId],
      };
    })
  );

  return resolved;
}

type Props = {
  params: {
    id: string;
  };
};

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = id;
  const postPromise = fetchPostData(postId);
  const commentsPromise = fetchComments(postId);

  const [postResult, commentsResult] = await Promise.allSettled([
    postPromise,
    commentsPromise,
  ]);

  if (postResult.status !== 'fulfilled') {
    // If we can't get the post, this page is unusable
    throw new Error('Failed to load post');
  }

  const postData = postResult.value;
  const comments = commentsResult.status === 'fulfilled' ? commentsResult.value : [];

  return (
    <main className="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-6 p-4">
      <div className="order-2 md:order-1 md:col-span-1">
        <PostMetadata post={postData.post} uploader={postData.uploaderInfo} />
      </div>

      <div className="space-y-6 order-1 md:order-2">
        <PostNavigator postId={postData.post.id} />
        <PostDisplay post={postData.post} />
      </div>

      <div className="md:col-span-2 space-y-4 order-3 md:order-3">
        <section className="border-t border-secondary-border pt-4 space-y-4">
          <h2 className="text-accent text-lg">Comments</h2>
          <PostCommentForm postId={postData.post.id} />
          <PostCommentList comments={comments} loading={false} error={null} />
        </section>
      </div>
    </main>
  );
}
