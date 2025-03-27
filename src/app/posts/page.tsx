import { Suspense } from "react";
import PostGrid from "@/components/clientSide/Posts/PostGrid";
import SearchBar from "@/components/clientSide/Posts/SearchBar";
import Filters from "@/components/clientSide/Posts/Filters";

export default function PostsPage() {
  return (
    <main className="p-4 space-y-4">
      <section className="flex flex-col md:flex-row gap-4">
        <SearchBar />
        <Filters />
      </section>

      <Suspense fallback={<p className="text-subtle">Loading posts...</p>}>
        <PostGrid />
      </Suspense>
    </main>
  );
}
