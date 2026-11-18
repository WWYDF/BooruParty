'use client';

import { useEffect, useState } from 'react';
import PostDisplay from './PostDisplay';
import PostMetadata from './PostMetadata';
import PostNavigator from './PostNavigator';
import PostCommentForm from './PostCommentForm';
import PostCommentList from './PostCommentList';
import LoadingOverlay from '@/components/LoadingOverlay';
import Button from '@/components/UI/Button';
import { useUser } from '@/components/UserProvider';
import { API } from '@/core/api';
import { PostDetail } from '@/core/types/posts';
import { CommentPage, CommentWriteResponse, EmbeddedPosts, PostComment } from '@/core/types/comments';
import { CategoryInfo } from '@/core/types/tags';

// GET /api/posts/:id/comments, newest first. `cursor` = the last comment id of the previous page.
async function fetchComments(postId: number, cursor?: number | null): Promise<CommentPage> {
  const params = cursor ? `?cursor=${cursor}` : '';
  const res = await API(`/api/posts/${postId}/comments${params}`);
  if (!res.ok) throw new Error('Failed to load comments');
  return res.json();
}

type LoadError = 'notFound' | 'unauthorized' | 'forbidden' | 'network';

export default function PostView({ postId, poolId }: { postId: number; poolId?: number }) {
  const { user } = useUser();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [categories, setCategories] = useState<Map<number, CategoryInfo>>(new Map());
  const [error, setError] = useState<LoadError | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [embeddedPosts, setEmbeddedPosts] = useState<EmbeddedPosts>({});
  const [commentCursor, setCommentCursor] = useState<number | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);

  // Next page of (older) comments
  const loadMoreComments = async () => {
    if (commentCursor === null || loadingComments) return;
    setLoadingComments(true);
    try {
      const page = await fetchComments(postId, commentCursor);
      setComments((prev) => [...prev, ...page.comments.filter((c) => !prev.some((p) => p.id === c.id))]);
      setEmbeddedPosts((prev) => ({ ...prev, ...page.embeddedPosts }));
      setCommentCursor(page.nextCursor);
    } catch {
      // the button stays, so they can try again
    } finally {
      setLoadingComments(false);
    }
  };

  // New or edited comment: put it in place and remember any posts it embeds
  const upsertComment = ({ comment, embeddedPosts: embedded }: CommentWriteResponse) => {
    setEmbeddedPosts((prev) => ({ ...prev, ...embedded }));
    setComments((prev) =>
      prev.some((c) => c.id === comment.id)
        ? prev.map((c) => (c.id === comment.id ? comment : c))
        : [comment, ...prev], // newest first
    );
  };

  const removeComment = (commentId: number) => setComments((prev) => prev.filter((c) => c.id !== commentId));

  useEffect(() => {
    let cancelled = false; // ignore results if the user navigates to another post first
    setPost(null);
    setError(null);

    (async () => {
      try {
        const [postRes, catRes] = await Promise.all([
          API(`/api/posts/${postId}`),
          API('/api/tag-categories'),
        ]);
        if (cancelled) return;

        if (!postRes.ok) {
          setError(
            postRes.status === 401 ? 'unauthorized'
            : postRes.status === 403 ? 'forbidden'
            : 'notFound', // 404, and 400 for a non-numeric id
          );
          return;
        }

        const cats: CategoryInfo[] = catRes.ok ? await catRes.json() : [];
        setCategories(new Map(cats.map((c) => [c.id, c])));
        setPost(await postRes.json());
      } catch {
        if (!cancelled) setError('network');
      }
    })();

    // Comments load separately so they never hold up the post itself
    setComments([]);
    setEmbeddedPosts({});
    setCommentCursor(null);
    fetchComments(postId)
      .then((page) => {
        if (cancelled) return;
        setComments(page.comments);
        setEmbeddedPosts(page.embeddedPosts);
        setCommentCursor(page.nextCursor);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [postId]);

  // After an edit: refetch just the post, keeping the current one on screen until the new one arrives
  const reloadPost = async () => {
    try {
      const res = await API(`/api/posts/${postId}`);
      if (res.ok) setPost(await res.json());
      else if (res.status === 404) setError('notFound');
    } catch {
      // keep showing what we have; a page refresh will retry
    }
  };

  if (error) return <PostError error={error} />;
  if (!post) return <LoadingOverlay show label="Loading Post..." />;

  const hasPerm = (perm: string) => user?.permissions.includes(perm) ?? false;
  const isOwner = !!user && user.id === post.uploader.id;
  const canEdit = hasPerm('posts.edit.others') || (isOwner && hasPerm('posts.edit.own'));
  const canComment = hasPerm('comment.create');

  return (
    <main className="grid grid-cols-1 lg:grid-cols-[375px_1fr] gap-6 p-4">
      {/* LEFT COLUMN - Metadata */}
      <div className="order-3 lg:order-1 lg:col-span-1 mt-6 lg:mt-0 border-r border-zinc-900">
        <PostMetadata post={post} categories={categories} canEdit={canEdit} onReload={reloadPost} />
      </div>

      {/* RIGHT COLUMN - Main content + Comments */}
      <div className="order-1 lg:order-2 space-y-6">
        <PostNavigator postId={post.id} poolId={poolId} />
        <PostDisplay post={post} />

        <section className="order-4 pt-4 space-y-4">
          <h2 className="text-accent text-lg">Comments</h2>
          {canComment && <PostCommentForm postId={post.id} onPosted={upsertComment} />}
          <PostCommentList
            comments={comments}
            embeddedPosts={embeddedPosts}
            parentSafety={post.safety}
            onUpdated={upsertComment}
            onDeleted={removeComment}
          />
          {commentCursor !== null && (
            <div className="flex justify-center">
              <Button size="sm" loading={loadingComments} onClick={loadMoreComments}>
                Load older comments
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PostError({ error }: { error: LoadError }) {
  const messages: Record<LoadError, { title: string; description: React.ReactNode }> = {
    notFound: { title: 'Post Not Found', description: "The post you're looking for doesn't exist or has been removed." },
    unauthorized: {
      title: 'Unauthorized',
      description: <>Please <a className="text-accent hover:underline" href="/auth/login">log in</a> to view this post.</>,
    },
    forbidden: { title: 'Access Denied', description: "Your account doesn't have permission to view posts." },
    network: { title: 'Failed to load post', description: 'Could not reach the server.' },
  };
  const { title, description } = messages[error];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-4 text-red-400">
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      <p className="text-base text-subtle max-w-md">{description}</p>
    </main>
  );
}
