'use client'

import * as React from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function SidebarList({ userId }: { userId: string }) {
  const [chats, setChats] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!userId) return

    const fetchChats = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('❌ Error fetching chats:', error)
      } else {
        setChats(data || [])
      }
      setLoading(false)
    }

    fetchChats()

    // Optional: subscribe for realtime updates
    const channel = supabase
      .channel('chats-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats', filter: `user_id=eq.${userId}` },
        () => {
          fetchChats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  if (loading) {
    return <p className="px-4 py-2 text-sm text-muted-foreground">Loading...</p>
  }

  if (chats.length === 0) {
    return <p className="px-4 py-2 text-sm text-muted-foreground">No chats yet.</p>
  }

  return (
    <div className="flex flex-col">
      {chats.map((chat) => (
        <Link
          key={chat.id}
          href={`/chat/${chat.id}`}
          className="px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          {chat.text || `Chat ${chat.id}`}
        </Link>
      ))}
    </div>
  )
}
