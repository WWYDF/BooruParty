import { auth } from "@/core/auth";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  let user;

  try {
    user = await prisma.user.findUnique({
      where: { id: session!.user.id },
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
  } catch {} // Will fail if the user is signed out.

  return NextResponse.json({
    userId: user?.id ? null : user?.id,
    permissions: user?.role?.permissions.map(p => p.name) ?? []
  });
}
