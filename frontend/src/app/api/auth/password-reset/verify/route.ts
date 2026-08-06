import { verifyResetCode } from '@/core/email';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { email, code } = await request.json();

  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
  }

  try {
    await verifyResetCode(email, code);
    return NextResponse.json({ valid: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Invalid or expired code' }, { status: 400 });
  }
}
