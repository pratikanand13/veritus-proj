'use client'

import { Plus, MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Chat {
  id: string
  title: string
  projectId: string
  createdAt: string
}

interface ChatListProps {
  chats: Chat[]
  projectId: string
  onCreateChat: (title: string) => void
  onSelectChat: (chatId: string) => void
  onDeleteChat: (chatId: string) => void
}

export function ChatList({
  chats,
  projectId,
  onCreateChat,
  onSelectChat,
  onDeleteChat,
}: ChatListProps) {
  const handleCreateChat = () => {
    const title = prompt('Enter chat title:')
    if (title && title.trim()) {
      onCreateChat(title.trim())
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Chats</h1>
        <Button
          onClick={handleCreateChat}
          className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="space-y-2">
        {chats.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No chats yet. Create your first chat!</p>
          </div>
        ) : (
          chats.map((chat) => (
            <Card
              key={chat.id}
              className="bg-[#1f1f1f] border-[#2a2a2a] hover:border-[#3a3a3a] cursor-pointer transition-colors"
              onClick={() => onSelectChat(chat.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-gray-400" />
                    <CardTitle className="text-white">{chat.title}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteChat(chat.id)
                    }}
                    className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-[#2a2a2a]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

