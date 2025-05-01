import { auth } from "@/core/auth";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode"); // "delete" | "transfer"
  const targetUserId = url.searchParams.get("user") ?? session.user.id;
  const isSelfDelete = targetUserId === session.user.id;

  // If attempting to delete someone else, check permission
  if (!isSelfDelete) {
    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        role: {
          include: { permissions: true }
        }
      }
    });

    const perms = current?.role?.permissions.map((p) => p.name) ?? [];

    if (!perms.includes("profile_delete_others") || !perms.includes("administrator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  
  try {
    if (mode === "transfer") {
      // Retain posts: Reassign to system user with id "0" (deleted)
      await prisma.posts.updateMany({
        where: { uploadedById: targetUserId },
        data: { uploadedById: "0" },
      });

      // Now run delete function (Settings, favorites, likes, etc.)
      await prisma.user.delete({
        where: { id: targetUserId },
      });
    } else {
      // Fully cascade delete (Posts, settings, favorites, likes, etc.)
      await prisma.user.delete({
        where: { id: targetUserId },
      });
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("User deletion failed:", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}