// Sections the old profile had that the new API doesn't serve yet (favorites, pools, collections, comments by user)
export default function ProfileComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        {title}
        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-2xs font-normal text-subtle">Coming soon</span>
      </h2>
      <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-600">
        {description}
      </div>
    </section>
  );
}
