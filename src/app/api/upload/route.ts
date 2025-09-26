import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    console.log('[Upload API] Processing file upload')
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.log('[Upload API] No file provided in request')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log(`[Upload API] Uploading file: ${file.name} (${file.size} bytes, ${file.type})`)

    // Check file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only MP4, WebM, OGG, and QuickTime videos are allowed.' },
        { status: 400 }
      )
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      )
    }

    // Generate a unique ID for the video
    const videoId = uuidv4()
    const filename = `uploads/videos/${videoId}-${file.name}`

    console.log(`[Upload API] Uploading to Vercel Blob with filename: ${filename}`)
    const blob = await put(filename, file, {
      access: 'public',
    })

    console.log(`[Upload API] Upload successful. URL: ${blob.url}`)

    return NextResponse.json({
      success: true,
      videoId: videoId,  // Use the UUID as the video ID
      url: blob.url,
      filename: file.name,  // Original filename for display
      size: file.size,
      type: file.type
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}