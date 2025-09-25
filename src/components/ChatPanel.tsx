'use client'

import { useState, useEffect, useRef } from 'react'
import { ChatMessage, User } from '@/types'

interface ChatPanelProps {
  messages: ChatMessage[]
  users: User[]
  currentUser: User | null
  onSendMessage: (message: string) => void
  className?: string
}

export default function ChatPanel({
  messages,
  users,
  currentUser,
  onSendMessage,
  className = ''
}: ChatPanelProps) {
  const [newMessage, setNewMessage] = useState('')
  const [prevMessageCount, setPrevMessageCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const isUserNearBottom = () => {
    if (!messagesContainerRef.current) return true

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    return scrollHeight - scrollTop - clientHeight < 100 // Within 100px of bottom
  }

  useEffect(() => {
    // Only auto-scroll if there are new messages and user is near bottom
    if (messages.length > prevMessageCount && isUserNearBottom()) {
      scrollToBottom()
    }
    setPrevMessageCount(messages.length)
  }, [messages, prevMessageCount])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUser) return

    onSendMessage(newMessage.trim())
    setNewMessage('')

    // Always scroll to bottom when current user sends a message
    setTimeout(() => scrollToBottom(), 100)
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={`bg-gray-800/50 backdrop-blur-sm rounded-lg flex flex-col ${className}`}>
      {/* Users List */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">
          Viewers ({users.length})
        </h3>
        <div className="space-y-2 max-h-24 overflow-y-auto">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${user.isHost ? 'bg-red-500' : 'bg-green-500'}`}></div>
              <span className={`text-sm ${user.isHost ? 'text-red-300' : 'text-gray-300'}`}>
                {user.name}
                {user.isHost && ' (Host)'}
                {user.id === currentUser?.id && ' (You)'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto min-h-0">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">💬</div>
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`p-3 rounded-lg ${
                  message.userId === currentUser?.id
                    ? 'bg-purple-600/30 ml-4'
                    : 'bg-gray-700/50 mr-4'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">
                    {message.username}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <p className="text-gray-200 text-sm">{message.message}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}