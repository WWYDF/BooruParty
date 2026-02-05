import { requestPasswordReset } from '@/core/email';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { email } = await request.json();
  
  await requestPasswordReset(email);
  
  return NextResponse.json({ message: 'If that email exists, a reset link has been sent' });
}