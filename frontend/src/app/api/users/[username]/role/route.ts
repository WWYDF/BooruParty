import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

// Changes the role of a user ((ADD PERMISSIONS TO THIS OML))
export async function PATCH(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const prams = await params;
  const { roleId } = await req.json();
  const username = prams.username;

  if (!roleId || !username) {
    return NextResponse.json({ error: "Missing roleId or username" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { username },
    data: { roleId },
  });

  return NextResponse.json({ ok: true, user });
}
