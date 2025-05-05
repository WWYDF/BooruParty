import { prisma } from "@/core/prisma";
import { SzuruTag } from "@/core/types/imports/szuru";
import { makeImportLogger } from "../importUtils";

export async function processSzuruExtras(
  tagsToProcess: SzuruTag[],
  tagRecords: Map<string, { id: number; name: string }>,
  sessionId: string
) {
  const log = makeImportLogger(sessionId);
  const missingImpliedTags = new Set<string>();
  const missingSuggestTags = new Set<string>();
  let insDoneCount = 0;

  for (const tag of tagsToProcess) {
    const canonical = tag.names[0].trim();
    const tagMeta = tagRecords.get(canonical);
    if (!tagMeta) continue;

    const aliases = tag.names.slice(1).map((a) => a.trim());

    const impliedNames = tag.implications.flatMap((i) => i.names.map((n) => n.trim().toLowerCase()));
    const impliedConnections = [];

    for (const impliedName of impliedNames) {
      if (impliedName === canonical || aliases.includes(impliedName)) continue;
      const implied = await prisma.tags.findUnique({ where: { name: impliedName } });
      if (implied) {
        impliedConnections.push({ id: implied.id });
        insDoneCount++;
      } else if (!missingImpliedTags.has(impliedName)) {
        missingImpliedTags.add(impliedName);
        await log("error", `Skipped missing implied tag: ${impliedName}`);
      }
    }

    if (impliedConnections.length > 0) {
      await prisma.tags.update({
        where: { id: tagMeta.id },
        data: { implications: { connect: impliedConnections } },
      });
    }

    const suggestedNames = tag.suggestions.flatMap((s) => s.names.map((n) => n.trim().toLowerCase()));
    const suggestedConnections = [];

    for (const suggestedName of suggestedNames) {
      const suggested = await prisma.tags.findUnique({ where: { name: suggestedName } });
      if (suggested) {
        suggestedConnections.push({ id: suggested.id });
        insDoneCount++;
      } else if (!missingSuggestTags.has(suggestedName)) {
        missingSuggestTags.add(suggestedName);
        await log("error", `Skipped missing suggested tag: ${suggestedName}`);
      }
    }

    if (suggestedConnections.length > 0) {
      await prisma.tags.update({
        where: { id: tagMeta.id },
        data: { suggestions: { connect: suggestedConnections } },
      });
    }

    if (insDoneCount % 100 === 0) {
      await log("info", `Processed ${insDoneCount} implications & suggestions...`);
    }
  }

  await log("success", `Finished importing ${insDoneCount} implications & suggestions.`);
}
