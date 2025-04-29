import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const body = await req.json();
  const { name, color, order } = body;

  const updated = await prisma.tagCategories.update({
    where: { id: parseInt(id) },
    data: { name, color, order },
  });

  return NextResponse.json(updated);
}

// export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
//   const { id } = await context.params;

//   try {
//     // Before deleting, you probably need to reassign all tags under this category!
//     const defaultCategory = await prisma.tagCategories.findFirst({
//       where: { name: "Default" }, // or whatever your default is
//     });

//     if (!defaultCategory) {
//       return new Response("Default category not found!", { status: 500 });
//     }

//     await prisma.tags.updateMany({
//       where: { categoryId: categoryId },
//       data: { categoryId: defaultCategory.id },
//     });

//     await prisma.tagCategory.delete({
//       where: { id: categoryId },
//     });

//     return new Response(null, { status: 204 }); // No content = success
//   } catch (error) {
//     console.error(error);
//     return new Response("Failed to delete category", { status: 500 });
//   }
// }