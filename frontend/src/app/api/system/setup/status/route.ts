import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const setup = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const user = await prisma.user.findFirst();

  return NextResponse.json({
    setupComplete: setup?.setupComplete ?? false,
    userExists: !!user,
  });
}
