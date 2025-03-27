import { notFound } from "next/navigation";
import { prisma } from "@/core/prisma";

type Props = {
  params: { id: string };
};

export default async function SinglePostPage({ params }: Props) {
  const postId = parseInt(params.id);
  const post = await prisma.posts.findUnique({
    where: { id: postId },
  });

  if (!post) return notFound();

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <img
        src={`/uploads/image/${post.fileName}`}
        alt={post.fileName}
        className="w-full max-h-[80vh] object-contain rounded-xl border border-secondary-border"
      />
      <div className="mt-4 text-subtle text-sm space-y-2">
        <p><strong>Uploaded by:</strong> {post.uploadedBy}</p>
        <p><strong>Tags:</strong> {post.tags.join(", ")}</p>
        <p><strong>Safety:</strong> {post.safety}</p>
        <p><strong>Notes:</strong> {post.notes || "None"}</p>
        <p><strong>Uploaded on:</strong> {new Date(post.createdAt).toLocaleString()}</p>
      </div>
    </main>
  );
}
