import { prisma } from "@/core/prisma";
import { SzuruTag } from "@/core/types/imports/szuru";
import { makeImportLogger } from "../importUtils";

export async function processSzuruTags(
  tagsToProcess: SzuruTag[],
  sessionId: string
) {
  const log = makeImportLogger(sessionId);
  const createdTags: string[] = [];
  const tagRecords = new Map<string, { id: number; name: string }>();
  let tagsDoneCount = 0;

  for (const tag of tagsToProcess) {
    tagsDoneCount++;
    const canonical = tag.names[0].trim().toLowerCase();
    const aliases = tag.names.slice(1).map((a) => a.trim().toLowerCase());
    const categoryName = tag.category.trim();

    let category;
    if (categoryName.toLowerCase() === "default") {
      category = await prisma.tagCategories.findFirst({ where: { isDefault: true } });
      if (!category) throw new Error("No default category defined in your database.");
    } else {
      category = await prisma.tagCategories.upsert({
        where: { name: categoryName },
        update: {},
        create: {
          name: categoryName,
          color: "#888888",
          isDefault: false,
        },
      });
    }

    let tagRecord = await prisma.tags.findUnique({ where: { name: canonical } });
    if (!tagRecord) {
      tagRecord = await prisma.tags.create({
        data: {
          name: canonical,
          description: tag.description ?? null,
          categoryId: category.id,
        },
      });
      createdTags.push(canonical);
    } else {
      await log('warn', `Tag already exists: ${canonical}`);
    }

    tagRecords.set(canonical, { id: tagRecord.id, name: canonical });

    for (const alias of aliases) {
      if (!alias) continue;
      await prisma.tagAlias.upsert({
        where: { alias },
        update: {},
        create: {
          alias,
          tagId: tagRecord.id,
        },
      });
    }

    if (tagsDoneCount % 100 === 0) {
      await log("info", `Processed ${tagsDoneCount} tags...`);
    }
  }

  await log("success", `Finished importing ${tagsDoneCount} tags.`);
  return tagRecords;
}
