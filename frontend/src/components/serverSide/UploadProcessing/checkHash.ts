import getPHash from "sharp-phash";
import { prisma } from '@/core/prisma';
import { extractVideoFrame } from "@/core/extractVideoFrame";
import { Post } from "@/core/types/posts";

export interface FileCheck {
    status: boolean,
    genHash: string,
    ogPost?: Post
}

export async function checkFile(file: Buffer, fileExt: string, fileType: 'other' | 'video' | 'image' | 'animated'): Promise<FileCheck> {
  
    let pHash: string;
  
    if (fileType === "video") {
        const frameBuffer = await extractVideoFrame(file, fileExt);
        pHash = await getPHash(frameBuffer);
    } else {
      // image or animated (like GIF/APNG) — sharp-phash works directly
      pHash = await getPHash(file);
    }
  
    const allHashes = await prisma.posts.findMany({
      where: {
        pHash: {
          not: null,
        },
      },
      select: {
        id: true,
        pHash: true,
      },
    });
  
    for (const post of allHashes) {
      const dist = hammingDistance(pHash, post.pHash!);
      if (dist <= 5) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts/${post.id}`, { headers: { "X-Override": `${process.env.INTERNAL_API_SECRET}` },});
          const data = await res.json();
          return {
            status: true,
            genHash: pHash,
            ogPost: data.post,
          };
        } catch (e) {
          console.error(`Error fetching dupe post! ${e}`);
          return {
            status: true,
            genHash: pHash,
          };
        }
      }
    }
  
    return {
      status: false,
      genHash: pHash,
    };
  }

function hammingDistance(a: string, b: string): number {
    if (a.length !== b.length) {
        throw new Error("Hashes must be the same length");
    }
  
    let dist = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) dist++;
    }

    return dist;
}