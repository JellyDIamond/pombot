'use client'

import * as React from 'react'
import { createClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { IconSidebar } from '@/components/ui/icons'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function Sidebar() {
  const [chats, setChats] = React.useState<any[]>([])

  React.useEffect(() => {
    const fetchChats = async () => {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error fetching chats:', error)
      } else {
        setChats(data || [])
      }
    }

    fetchChats()
  }, [])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" className="-ml-2 h-9 w-9 p-0">
          <IconSidebar className="h-6 w-6" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="inset-y-0 flex h-auto w-[300px] flex-col p-0">
        <SheetHeader className="p-4">
          <SheetTitle className="text-sm">Chat History</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col overflow-y-auto px-4">
          {chats.length === 0 ? (
            <p className="text-xs text-gray-500">No chats yet.</p>
          ) : (
            chats.map((chat) => (
              <div key={chat.id} className="py-2 border-b border-gray-200">
                <a href={`/chat/${chat.id}`} className="text-sm hover:underline">
                  {chat.text || chat.id}
                </a>
                <p className="text-xs text-gray-500">
                  {new Date(chat.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
