import { prisma } from "@/core/prisma";
import { Buffer } from "buffer";
import { SzuruTag, SzuruResponse } from "@/core/types/imports/szuru";
import { makeImportLogger, setSessionDuration, sleep } from "../importUtils";
import { processSzuruTags } from "./szuruTags";
import { processSzuruExtras } from "./szuruExtras";
import { processSzuruPosts } from "./szuruPosts";
import { Session } from "next-auth";

interface RunSzuruImportOptions {
  url: string;
  username: string;
  password: string;
  sessionId: string;
  userCookie: string;
}

export async function runSzuruImport({ url, username, password, sessionId, userCookie }: RunSzuruImportOptions) {
  const log = makeImportLogger(sessionId);
  const startTime = new Date();

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
  
    const tagRecords = await processSzuruTags(tagsToProcess, sessionId);
    await sleep(900);
    await log("info", "Phase 2: Adding Implications and Suggestions...");

    await sleep(1200);
    await processSzuruExtras(tagsToProcess, tagRecords, sessionId);

    await sleep(900);
    await log("info", "Phase 3: Adding Posts with tags...");

    await sleep(1200);
    const postsStatus = await processSzuruPosts({ sessionId, url, username, password, userCookie, limit: 20 })
    if (!postsStatus) throw new Error('Post failed to upload, aborting!');
  
    await log('success', `Import complete.`);

    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      }
    });

    await setSessionDuration(sessionId, startTime, "COMPLETED");

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
    await setSessionDuration(sessionId, startTime, "ERROR");
  }
};