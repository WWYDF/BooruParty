import { prisma } from "../prisma";

export function makeImportLogger(sessionId: string) {
  return async (level: "info" | "warn" | "error" | "success", message: string) => {
    console.debug(`[${level.toLocaleUpperCase()}]: ${message}`);
    await prisma.importLog.create({
      data: {
        sessionId,
        level,
        message,
      },
    });
  };
}


export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}