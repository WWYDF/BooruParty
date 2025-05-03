'use client';

import { getSession } from 'next-auth/react';

export async function getClientSession() {
  const session = await getSession(); // pulls session from client cookies
  return session;
}
