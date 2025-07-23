import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/lib/db_types'
import { type Chat } from '@/lib/types'
import { SidebarActions } from '@/components/sidebar-actions'
import { SidebarItem } from '@/components/sidebar-item'
import { removeChat, shareChat } from '@/app/actions'

export interface SidebarListServerProps {
  userId?: string
}

export async function SidebarListServer({ userId }: SidebarListServerProps) {
  if (!userId) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Please sign in to see chat history</p>
      </div>
    )
  }

  let chats: Chat[] = []
  
  try {
    const cookieStore = cookies()
    const supabase = createServerActionClient<Database>({
      cookies: () => cookieStore
    })
    
    const { data, error } = await supabase
      .from('chats')
      .select('payload')
      .order('payload->createdAt', { ascending: false })
      .eq('user_id', userId)

    if (!error && data) {
      chats = data
        .map(entry => entry.payload as Chat)
        .filter(chat => chat && chat.id && chat.title)
    }
  } catch (error) {
    chats = []
  }

  return (
    <div className="flex-1 overflow-auto">
      {chats?.length ? (
        <div className="space-y-2 px-2">
          {chats.map(chat => (
            <SidebarItem key={chat.id} chat={chat}>
              <SidebarActions
                chat={chat}
                removeChat={removeChat}
                shareChat={shareChat}
              />
            </SidebarItem>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No chat history</p>
        </div>
      )}
    </div>
  )
}