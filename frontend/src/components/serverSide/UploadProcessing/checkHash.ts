import getPHash from "sharp-phash";
import { prisma } from '@/core/prisma';

export interface FileCheck {
    status: boolean,
    genHash: string,
    postId?: number
}

export async function checkFile(file: Buffer): Promise<FileCheck> {
    const pHash = await getPHash(file);

    // Only pull id + pHash (minimize memory)
    const allHashes = await prisma.posts.findMany({
        where: {
            pHash: {
            not: null,
            }
        },
        select: {
            id: true,
            pHash: true
        }
    });

    for (const post of allHashes) {
        const dist = hammingDistance(pHash, post.pHash!);
        if (dist <= 5) {
            return {
                status: true,
                genHash: pHash,
                postId: post.id
            };
        }
    }

    return {
        status: false,
        genHash: pHash
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