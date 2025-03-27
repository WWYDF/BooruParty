import { useState } from "react";
import EditPostModal from "./EditPost";

type Props = {
    post: {
      id: number;
      uploadedBy: string;
      anonymous: boolean;
      safety: string;
      tags: string[];
      sources: string[];
      notes: string | null;
      createdAt: string;
    };
  };
  

export default function PostMetadata({ post }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setEditing(true)}
        className="self-start px-3 py-1 rounded-xl bg-secondary-border text-sm text-subtle"
      >
        ✏️ Edit
      </button>

      <div className="text-subtle text-sm space-y-1">
        <p><strong>Uploader:</strong> {post.anonymous ? "Anonymous" : post.uploadedBy}</p>
        <p><strong>Safety:</strong> {post.safety}</p>
        <p><strong>Tags:</strong> {post.tags.length ? post.tags.join(", ") : "None"}</p>
        <p><strong>Sources:</strong> {post.sources.length ? post.sources.join(", ") : "None"}</p>
        <p><strong>Notes:</strong> {post.notes || "None"}</p>
        <p><strong>Uploaded on:</strong> {new Date(post.createdAt).toLocaleString()}</p>
      </div>

      {editing && (
        <EditPostModal
          post={post}
          onClose={() => setEditing(false)}
          onSuccess={() => location.reload()} // or refetch locally
        />
      )}
    </div>
  );
}
