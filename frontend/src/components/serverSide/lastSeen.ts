'use server'

import { prisma } from '@/core/prisma';

export async function updateLastSeen(userId: string) {
  await prisma.user.update({
    where: { id: userId as string},
    data: { lastLogin: new Date() } // its actually last seen now
  })
}