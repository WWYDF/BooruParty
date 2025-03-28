import { PrismaClient } from '@prisma';

declare global {
  // Prevent multiple instances in development
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ?? new PrismaClient(); // no logging

if (process.env.NODE_ENV === "development") {
  global.prisma = prisma;
}
