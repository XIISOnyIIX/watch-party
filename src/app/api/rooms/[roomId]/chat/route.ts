import { NextRequest, NextResponse } from 'next/server'
import { databaseService } from '@/lib/database'
import { ChatMessage } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const resolvedParams = await params
    const body = await request.json()
    const { userId, username, message } = body

    if (!userId || !username || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const chatMessage: ChatMessage = {
      id: uuidv4(),
      userId,
      username,
      message: message.trim(),
      timestamp: new Date()
    }

    await databaseService.addMessage(resolvedParams.roomId, chatMessage)

    return NextResponse.json({ success: true, message: chatMessage })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const resolvedParams = await params
    const messages = await databaseService.getMessages(resolvedParams.roomId)
    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Chat GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}