import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session ID." }, { status: 400 });
  }

  const session = await prisma.importSession.findUnique({
    where: { id: sessionId },
    include: {
      logs: {
        orderBy: { timestamp: "asc" },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Import session not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    type: session.type,
    status: session.status,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    logs: session.logs.map((log) => ({
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
    })),
  });
}