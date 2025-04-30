import { NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';

export async function GET() {
  const totalPosts = await prisma.posts.count();

  let totalMB = 0;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/stats`);
    const json = await res.json();
    totalMB = json.totalMB;
  } catch (e) {
    console.error('Failed to fetch storage stats:', e);
  }

  return NextResponse.json({ totalPosts, totalMB });
}
