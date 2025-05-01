import { auth } from "@/core/auth";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: {
        select: {
          permissions: {
            select: { name: true }
          }
        }
      }
    }
  });

  return NextResponse.json({
    userId: user?.id,
    permissions: user?.role?.permissions.map(p => p.name) ?? []
  });
}
