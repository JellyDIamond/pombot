import { type Message } from 'ai'

import { Separator } from '@/components/ui/separator'
import { ChatMessage } from '@/components/chat-message'
import { IconOpenAI } from '@/components/ui/icons'
import { MemoizedReactMarkdown } from '@/components/markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { cn } from '@/lib/utils'

export interface ChatList {
  messages: Message[]
  streamingReply?: string
  isLoading?: boolean
}

export function ChatList({ messages, streamingReply, isLoading }: ChatList) {
  if (!messages.length && !streamingReply) {
    return null
  }

  return (
    <div className="relative mx-auto max-w-2xl px-4">
      {messages.map((message, index) => (
        <div key={index}>
          <ChatMessage message={message} />
          {index < messages.length - 1 && (
            <Separator className="my-4 md:my-8" />
          )}
        </div>
      ))}
      
      {/* Show streaming reply in proper assistant message format */}
      {isLoading && streamingReply && (
        <>
          {messages.length > 0 && <Separator className="my-4 md:my-8" />}
          <div className={cn('group relative mb-4 flex items-start md:-ml-12')}>
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow',
                'bg-primary text-primary-foreground'
              )}
            >
              <IconOpenAI />
            </div>
            <div className="chatbox-message ml-4 flex-1 space-y-2 overflow-hidden px-1">
              <MemoizedReactMarkdown
                className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0"
                remarkPlugins={[remarkGfm, remarkMath]}
                components={{
                  p({ children }) {
                    return <p className="mb-2 last:mb-0">{children}</p>
                  }
                }}
              >
                {streamingReply}
              </MemoizedReactMarkdown>
            </div>
          </div>
        </>
      )}
    </div>
  )
}