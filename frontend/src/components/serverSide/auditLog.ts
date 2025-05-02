// Server Side Only!! (DO NOT CALL FROM CLIENT MODULES)
import { prisma } from "@/core/prisma";
import { AuditAction, AuditCategory } from "@prisma/client";

export async function reportAudit(userId: string, category: AuditCategory, actionType: AuditAction, details?: string) {
  await prisma.audits.create({
    data: {
      category,
      actionType,
      userId,
      details,
    }
  })
}