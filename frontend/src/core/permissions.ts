import { prisma } from "@/core/prisma";
import { auth } from "@/core/auth";
import { NextResponse } from "next/server";

export async function checkPermissions(permission: string) {
  const session = await auth();
  
  if (permission == 'posts_view') {
    if (process.env.GUEST_VIEWING == 'true') { return {success: true} }
  }


  if (!session?.user?.id) {
    return { success: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: {
        include: { permissions: true }
      }
    }
  });

  const allowed = user?.role?.permissions.some((p) => p.name === permission) ?? false;

  if (!allowed) {
    return { success: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { success: true, user };
}