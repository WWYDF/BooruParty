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

  const originalTagNames = original.tags.map((t: any) => t.name);
  const updatedTagNames = updated.tags.map((t: any) => t.name);

  const addedTags = updatedTagNames.filter((name: string) => !originalTagNames.includes(name)).sort();
  const removedTags = originalTagNames.filter((name: string) => !updatedTagNames.includes(name)).sort();

  if (addedTags.length > 0 || removedTags.length > 0) {
    const changesList = [];
    if (addedTags.length > 0) changesList.push(`+[${addedTags.join(", ")}]`);
    if (removedTags.length > 0) changesList.push(`-[${removedTags.join(", ")}]`);
    changes.push(`tags: ${changesList.join(", ")}`);
  }

  return changes.length ? `Edited Post: ${updated.id}\nChanges:\n- ${changes.join("\n- ")}` : `Edited Post: ${updated.id}`;
}

export function normalizeString(val: any) {
  return val?.toString().trim() || "";
}