import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

// Create new role
export async function POST(req: Request) {
  const { name } = await req.json();

  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const newRole = await prisma.role.create({
    data: {
      name,
      isDefault: false,
    },
    include: { permissions: true, users: true },
  });

  return NextResponse.json(newRole);
}