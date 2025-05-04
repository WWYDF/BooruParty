import { reportAudit } from "@/components/serverSide/auditLog";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/authServer";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const body = await req.json();
  const { name, color, order } = body;
  const session = await auth();

  const hasPerms = (await checkPermissions(['tags_categories_manage']))['tags_categories_manage'];
  if (!session || !hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  const updated = await prisma.tagCategories.update({
    where: { id: parseInt(id) },
    data: { name, color, order },
  });

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const changeDetails = `Edited Category: ${id}\nChanges:\n- Name: ${name}\n- Color: ${color}\n- Order: ${order}}`;
  await reportAudit(session.user.id, 'EDIT', 'CATEGORY', ip, changeDetails);

  return NextResponse.json(updated);
}


// Why is this commented out?

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