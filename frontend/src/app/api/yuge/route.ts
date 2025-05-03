import { auth } from "@/core/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  return NextResponse.json({
    user: session?.user,
  });
}