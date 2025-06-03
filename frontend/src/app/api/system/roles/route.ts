import { NextResponse } from "next/server";
import { prisma } from '@/core/prisma';

// This should be moved to /api/roles but I'm leaving it here for now for compatibility...
export async function GET() {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: true
      }
    })

    return NextResponse.json(roles, { status: 200 });
  } catch (err) {
    console.error("GET /api/system/roles error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
