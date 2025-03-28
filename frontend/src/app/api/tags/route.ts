import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const searchParam = url.searchParams.get('search');
    const tag = searchParam ? String(searchParam) : undefined;

    if (tag) {
        try {
            const prismaSearch = await prisma.tagName.findMany({
              where: {
                name: {
                  contains: tag,
                  mode: 'insensitive',
                },
              },
              include: {
                parentTag: {
                  include: {
                    names: true, // Include all names (aliases + canonical)
                    category: true, // Optional: if you want the category too
                  },
                },
              },
            });
              
            return NextResponse.json(prismaSearch);
    
        } catch (error) {
            return NextResponse.json({ error: `Failed to fetch tag data for '${tag}': ${error}` }, { status: 500 });
        }
    }
}