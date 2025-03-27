import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/core/prisma";
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import Busboy from 'busboy'
import { auth } from '@/core/auth'
import consola from 'consola'
import { processImageForPost } from '@/components/serverSide/UploadProcessing/ProcessImage';

export const logger = consola.withTag('API')

function getFileType(ext: string): 'image' | 'video' | 'animated' {
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp']
  const videoExts = ['.mp4', '.webm', '.mov', '.mkv']
  const animatedExts = ['.gif', '.apng']
  if (imageExts.includes(ext)) return 'image'
  if (videoExts.includes(ext)) return 'video'
  if (animatedExts.includes(ext)) return 'animated'
  return 'image'
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const contentType = req.headers.get('content-type') || ''
    const busboy = Busboy({ headers: { 'content-type': contentType } })

    const buffers: Buffer[] = []
    let originalFilename = ''
    let anonymous = false
    let safety: 'safe' | 'sketchy' | 'unsafe' = 'safe'

    const fileProcessed = new Promise((resolve, reject) => {
      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'anonymous') {
          anonymous = value === 'true'
        }
      })

      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'anonymous') {
          anonymous = value === 'true'
        }
        if (fieldname === 'safety' && ['safe', 'sketchy', 'unsafe'].includes(value)) {
          safety = value as 'safe' | 'sketchy' | 'unsafe'
        }
      })

      busboy.on('file', (_name, file, info) => {
        originalFilename = info.filename
        file.on('data', (data) => buffers.push(data))
        file.on('end', resolve)
      })
      busboy.on('error', reject)
    })

    const reqBuffer = Buffer.from(await req.arrayBuffer())
    busboy.end(reqBuffer)

    await fileProcessed

    if (!originalFilename) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const ext = path.extname(originalFilename).toLowerCase()
    const fileType = getFileType(ext)

    // Step 1: Create empty DB record to get `id`
    const newPost = await prisma.posts.create({
      data: {
        fileName: '', // temporary
        uploadedBy: session.user.id,
        anonymous,
        safety,
        tags: [],
        sources: [],
        notes: null,
        flags: [],
      },
    })

    // Step 2: Use the ID to create final file name
    const fileName = `${newPost.id}${ext}`
    const saveDir = path.join(process.cwd(), 'public/uploads', fileType)
    await mkdir(saveDir, { recursive: true })
    const fullPath = path.join(saveDir, fileName)
    await writeFile(fullPath, Buffer.concat(buffers))

    // Generate preview + thumbnails if applicable
    if (fileType === 'image') {
      await processImageForPost(newPost.id, fullPath, fileType)
    }

    // Step 3: Update DB with final file name
    await prisma.posts.update({
      where: { id: newPost.id },
      data: { fileName },
    })

    return NextResponse.json({
      success: true,
      fileUrl: `/uploads/${fileType}/${fileName}`,
      post: { ...newPost, fileName },
    })
  } catch (err) {
    logger.error('Upload failed:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
