// Server Side Only!! (DO NOT CALL FROM CLIENT MODULES)
import { prisma } from "@/core/prisma";
import { AuditAction, AuditCategory } from "@prisma/client";

export async function reportAudit(userId: string, category: AuditCategory, actionType: AuditAction, address?: string, details?: string) {
  await prisma.audits.create({
    data: {
      category,
      actionType,
      userId,
      details,
      address,
    }
  })
}


export function buildPostChangeDetails(original: any, updated: any): string {
  const changes: string[] = [];

  if (normalizeString(original.notes) !== normalizeString(updated.notes))
    changes.push(`notes: "${normalizeString(original.notes)}" → "${normalizeString(updated.notes)}"`);
  if (normalizeString(original.sources) !== normalizeString(updated.sources))
    changes.push(`sources: "${normalizeString(original.sources)}" → "${normalizeString(updated.sources)}"`);
  if (original.safety !== updated.safety)
    changes.push(`safety: ${original.safety} → ${updated.safety}`);
  if (original.anonymous !== updated.anonymous)
    changes.push(`anonymous: ${original.anonymous} → ${updated.anonymous}`);

  const originalTagIds = original.tags.map((t: any) => t.id).sort();
  const updatedTagIds = updated.tags.map((t: any) => t.id).sort();
  if (JSON.stringify(originalTagIds) !== JSON.stringify(updatedTagIds)) {
    changes.push(`tags: [${originalTagIds.join(", ")}] → [${updatedTagIds.join(", ")}]`);
  }

  return changes.length ? `Edited Post: ${updated.id}\nChanges:\n- ${changes.join("\n- ")}` : `Edited Post: ${updated.id}`;
}

export function normalizeString(val: any) {
  return val?.toString().trim() || "";
}