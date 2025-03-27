import TagCategoryManager from "@/components/clientSide/Tags/Categories/Manager";
import { prisma } from "@/core/prisma";

export default async function TagDashboard() {
  const categories = await prisma.tagCategories.findMany({
    orderBy: { order: "asc" },
  });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-accent">Tag Categories</h1>
      <TagCategoryManager initialData={categories} />
    </div>
  );
}
