"use client";

type Props = {
  postId: number;
};

export default function PostComments({ postId }: Props) {
  return (
    <section className="border-t border-secondary-border pt-4">
      <h2 className="text-accent text-lg mb-2">Comments</h2>
      <p className="text-subtle text-sm italic">Comments are coming soon.</p>
    </section>
  );
}
