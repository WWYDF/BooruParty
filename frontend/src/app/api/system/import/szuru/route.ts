import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { Buffer } from "buffer";
import { SzuruResponse, SzuruTag } from "@/core/types/imports/szuru";

export async function POST(req: NextRequest) {
  const { url, username, password } = await req.json();

  if (!url || !username || !password)
    return NextResponse.json({ error: "Missing credentials or URL" }, { status: 400 });

  const auth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  const fetchAllTags = async (): Promise<SzuruTag[]> => {
    const limit = 100;
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
    await fetchCategories();
    const allTags = await fetchAllTags();
    const tags = allTags.slice(0, 1);
    console.log("Testing with tag:", tags[0].names[0]);

    const createdTags: string[] = [];

    for (const tag of tags) {
      const canonical = tag.names[0].trim();
      const aliases = tag.names.slice(1).map((a: any) => a.trim());
      const categoryName = tag.category.trim();

      // Get or create category
      let category;

      if (categoryName.toLowerCase() === "default") {
        category = await prisma.tagCategories.findFirst({
          where: { isDefault: true }
        });

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

      // Check if tag exists
      const existingTag = await prisma.tags.findUnique({
        where: { name: canonical },
      });

      let tagRecord;
      if (!existingTag) {
        tagRecord = await prisma.tags.create({
          data: {
            name: canonical,
            description: tag.description ?? null,
            categoryId: category.id,
          },
        });
        createdTags.push(canonical);
      } else {
        tagRecord = existingTag;
      }

      // Add aliases
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

      // Add implications
      for (const impliedName of tag.implications.flatMap((i: any) => i.names)) {
        const implied = await prisma.tags.findUnique({ where: { name: impliedName } });
        if (implied) {
          await prisma.tags.update({
            where: { id: tagRecord.id },
            data: {
              implications: {
                connect: { id: implied.id }
              }
            }
          });
        }
      }

      // Add suggestions
      for (const suggestedName of tag.suggestions.flatMap((s: any) => s.names)) {
        const suggested = await prisma.tags.findUnique({ where: { name: suggestedName } });
        if (suggested) {
          await prisma.tags.update({
            where: { id: tagRecord.id },
            data: {
              suggestions: {
                connect: { id: suggested.id }
              }
            }
          });
        }
      }
    }

    return NextResponse.json({ success: true, created: createdTags.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}