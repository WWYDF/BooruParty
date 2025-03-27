type ResolvedComment = {
  id: number;
  postId: number;
  content: string;
  createdAt: string;
  authorName: string;
};

export default function PostCommentList({
  comments,
  loading,
  error,
}: {
  comments: ResolvedComment[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <p className="text-subtle text-sm">Loading comments...</p>;
  if (error) return <p className="text-red-500 text-sm">Error: {error}</p>;
  if (!comments.length) return <p className="text-subtle text-sm italic">No comments yet.</p>;

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="bg-secondary-border p-3 rounded-xl text-sm text-subtle"
        >
          <div className="text-xs text-muted mb-1">
            {comment.authorName} · {new Date(comment.createdAt).toLocaleString()}
          </div>
          <p>{comment.content}</p>
        </div>
      ))}
    </div>
  );
}
