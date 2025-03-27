import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'

const sizes = {
  small: 200,
  medium: 600,
  large: 900,
} as const

type PostType = 'image' | 'animated' | 'video'

export async function generateThumbnails(postId: number, inputPath: string, type: PostType) {
  const baseDir = path.join(process.cwd(), 'public/thumbnails', type)
  await fs.mkdir(baseDir, { recursive: true })

  for (const [label, width] of Object.entries(sizes)) {
    const outputPath = path.join(baseDir, `${label}_${postId}.webp`)
    await sharp(inputPath)
      .resize({ width: width as number, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(outputPath)
  }
}
