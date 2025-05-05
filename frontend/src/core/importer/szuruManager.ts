import { prisma } from "@/core/prisma";
import { Buffer } from "buffer";
import { SzuruTag, SzuruResponse } from "@/core/types/imports/szuru";
import { makeImportLogger, sleep } from "./importUtils";

interface RunSzuruImportOptions {
  url: string;
  username: string;
  password: string;
  sessionId: string;
}

export async function runSzuruImport({ url, username, password, sessionId }: RunSzuruImportOptions) {
  const log = makeImportLogger(sessionId);

  const auth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  const fetchAllTags = async (): Promise<SzuruTag[]> => {
    const limit = 100; // Per Page, this is the max allowed by szuruBooru
    let offset = 0;
    let all: SzuruTag[] = [];

    const countRes = await fetch(`${url}/api/tags?offset=0&limit=1`, {
      headers: { 
        "Authorization": auth,
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    });

    if (!countRes.ok) throw new Error("Failed to fetch tag count");
    const first: SzuruResponse = await countRes.json();
    const total = first.total;

    while (offset < total) {
      const res = await fetch(`${url}/api/tags?offset=${offset}&limit=${limit}`, {
        headers: { 
          "Authorization": auth,
          "Accept": "application/json",
          "Content-Type": "application/json"
        }
      });
      if (!res.ok) throw new Error(`Failed to fetch tags at offset ${offset}`);
      const batch: SzuruResponse = await res.json();
      all.push(...batch.results);
      offset += limit;
    }

    return all;
  };

  const fetchCategories = async () => {
    const res = await fetch(`${url}/api/tag-categories`, {
      headers: { 
        "Authorization": auth,
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    });
  
    if (!res.ok) throw new Error("Failed to fetch tag categories");

    const data = await res.json();
    const categories = data.results;

    for (const category of categories) {
      if (category.name.toLowerCase() === "default") continue; // skip importing it
  
      await prisma.tagCategories.upsert({
        where: { name: category.name },
        update: {
          color: category.color === "default" ? "#888888" : category.color,
        },
        create: {
          name: category.name,
          color: category.color === "default" ? "#888888" : category.color,
          isDefault: category.default ?? false,
        }
      });
    }
  };

  try {
    const TEST_TAGS = ['""test""', 'human', 'alcohol', 'beer', 'female']; // Expand manually as needed
    const TEST_MODE = false;
  
    await log('info', "Fetching Tags Categories...");
    await fetchCategories();
    await log('success', "Fetched Tag Categories!");
  
    await log('info', "Fetching Tags...");
    const allTags = await fetchAllTags();
    await log('success', `Fetched ${allTags.length} tags from Szuru!`);

    let tagsToProcess: SzuruTag[] = allTags;

    if (TEST_MODE) {
      await log('warn', `Test mode: only processing tag "${TEST_TAGS}"`);
      tagsToProcess = allTags.filter((tag) => TEST_TAGS.includes(tag.names[0]));
    } else {
      await log('info', `Importing all ${allTags.length} tags`);
    }
  
    if (tagsToProcess.length === 0) throw new Error("No tags matched test filter.");
  
    await log('info', `Importing ${tagsToProcess.length} Tags (Phase 1: Create Tags + Aliases)...`);
  
    const createdTags: string[] = [];
    const tagRecords = new Map<string, { id: number; name: string }>();
    let tagsDoneCount = 0;
  
    // Phase 1: Create tags and aliases
    for (const tag of tagsToProcess) {
      tagsDoneCount++;
      const canonical = tag.names[0].trim();
      const aliases = tag.names.slice(1).map((a) => a.trim());
      const categoryName = tag.category.trim();
  
      // await log('info', `Processing tag: ${canonical}`);
  
      // Resolve category
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
  
      // Create or get tag
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
        // await log('info', `Created tag: ${canonical}`);
      } else {
        await log('warn', `Tag already exists: ${canonical}`);
      }
  
      tagRecords.set(canonical, { id: tagRecord.id, name: canonical });
  
      // Aliases
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
        // await log('info', `Added alias: ${alias}`);
      }

      // Log for every 100 tags completed to manage the lag.
      if (tagsDoneCount % 100 === 0) {
        await log("info", `Processed ${tagsDoneCount} tags...`);
      }
    }

    await log("success", `Finished importing ${tagsDoneCount} tags.`);
    await sleep(900);
  
    // Phase 2: Implications and suggestions
    await log('info', `Phase 2: Adding Implications and Suggestions...`);
    await sleep(1200);
    let insDoneCount = 0;
  
    for (const tag of tagsToProcess) {
      const canonical = tag.names[0].trim();
      const tagMeta = tagRecords.get(canonical);
      if (!tagMeta) continue;
  
      const aliases = tag.names.slice(1).map((a) => a.trim());
  
      // Implications
      const impliedNames = tag.implications.flatMap((i) => i.names.map((n) => n.trim()));
      const impliedConnections = [];
  
      for (const impliedName of impliedNames) {
        if (impliedName === canonical || aliases.includes(impliedName)) continue;
  
        const implied = await prisma.tags.findUnique({ where: { name: impliedName } });
        if (implied) {
          impliedConnections.push({ id: implied.id });
          insDoneCount++;
          // await log('info', `Implication: ${canonical} → ${implied.name}`);
        } else {
          await log('error', `Skipped missing implied tag: ${impliedName}`);
        }
      }
  
      if (impliedConnections.length > 0) {
        await prisma.tags.update({
          where: { id: tagMeta.id },
          data: {
            implications: {
              connect: impliedConnections,
            },
          },
        });
      }
  
      // Suggestions
      const suggestedNames = tag.suggestions.flatMap((s) => s.names.map((n) => n.trim()));
      const suggestedConnections = [];
  
      for (const suggestedName of suggestedNames) {
        const suggested = await prisma.tags.findUnique({ where: { name: suggestedName } });
        if (suggested) {
          suggestedConnections.push({ id: suggested.id });
          insDoneCount++;
          // await log('info', `Suggestion: ${canonical} → ${suggested.name}`);
        } else {
          await log('error', `Skipped missing suggested tag: ${suggestedName}`);
        }
      }
  
      if (suggestedConnections.length > 0) {
        await prisma.tags.update({
          where: { id: tagMeta.id },
          data: {
            suggestions: {
              connect: suggestedConnections,
            },
          },
        });
      }

      // Log for every 100 of both implications & suggestions combined.
      if (insDoneCount % 100 === 0) {
        await log("info", `Processed ${insDoneCount} implications & suggestions...`);
      }
    }

    await log("success", `Finished importing ${insDoneCount} implications & suggestions.`);
    await sleep(900);
  
    await log('success', `Import complete.`);

    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      }
    });

    return;

  } catch (e: any) {
    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: "ERROR",
        completedAt: new Date()
      }
    });
    await log("error", `Import failed: ${e.message}`);
  }
};