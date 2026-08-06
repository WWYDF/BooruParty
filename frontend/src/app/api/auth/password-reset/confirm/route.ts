import { resetPassword } from '@/core/email';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { email, code, password } = await request.json();

  if (!email || !code || !password) {
    return NextResponse.json({ error: 'Email, code, and password are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  try {
    await resetPassword(email, code, password);
    return NextResponse.json({ message: 'Password has been reset' });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Invalid or expired code' }, { status: 400 });
  }
}
