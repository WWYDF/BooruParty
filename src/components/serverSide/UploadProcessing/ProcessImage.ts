import sharp from 'sharp'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { generateThumbnails } from './GenerateThumbnails'
import { mkdirSync } from 'fs'

const prisma = new PrismaClient()

export async function processImageForPost(postId: number, inputPath: string, type: 'image' | 'animated' | 'video') {
  mkdirSync(path.join(process.cwd(), 'public/previews'), { recursive: true })
  const previewOutput = path.join(process.cwd(), 'public/previews', `${postId}.webp`)

  const image = sharp(inputPath)
  const metadata = await image.metadata()

  const resized = image.resize({ width: 1280, withoutEnlargement: true })
  const { width: resizedWidth } = await resized
    .webp({ quality: 80 })
    .toFile(previewOutput)

  const previewScale = metadata.width && resizedWidth
    ? Math.round((resizedWidth / metadata.width) * 100)
    : null

  await prisma.posts.update({
    where: { id: postId },
    data: { previewScale },
  })

  await generateThumbnails(postId, inputPath, type)
}