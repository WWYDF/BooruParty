import { resetPassword } from '@/core/email';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { token, password } = await request.json();

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  try {
    await resetPassword(token, password);
    return NextResponse.json({ message: 'Password has been reset' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }
}
