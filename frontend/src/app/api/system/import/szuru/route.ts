import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { auth } from "@/core/authServer";
import { runSzuruImport } from "@/core/importer/szurubooru/szuruManager";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const { url, username, password } = await req.json();

  if (!url || !username || !password) {
    return NextResponse.json({ error: "Missing import credentials." }, { status: 400 });
  }

  // Optional: retrieve authenticated user
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const cookieHeader = cookies().toString();

  // Create a new import session
  const importSession = await prisma.importSession.create({
    data: {
      userId: session.user.id,
      type: "SZURU",
      status: "PENDING",
    },
  });

  // Start import in background
  runSzuruImport({
    url,
    username,
    password,
    sessionId: importSession.id,
    userCookie: cookieHeader,
  }).catch(async (err: any) => {
    await prisma.importSession.update({
      where: { id: importSession.id },
      data: {
        status: "ERROR",
        completedAt: new Date(),
      },
    });
    await prisma.importLog.create({
      data: {
        sessionId: importSession.id,
        level: "error",
        message: `Import crashed: ${err.message}`,
      },
    });
    console.error(`Szuru import failed: ${err.message}`);
  });

  return NextResponse.json({ sessionId: importSession.id });
}
