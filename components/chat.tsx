'use client'

import { useChat, type Message } from 'ai/react'

import { cn } from '@/lib/utils'
import { ChatList } from '@/components/chat-list'
import { ChatPanel } from '@/components/chat-panel'
import { EmptyScreen } from '@/components/empty-screen'
import { ChatScrollAnchor } from '@/components/chat-scroll-anchor'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { toast } from 'react-hot-toast'

const IS_PREVIEW = process.env.VERCEL_ENV === 'preview'
export interface ChatProps extends React.ComponentProps<'div'> {
  initialMessages?: Message[]
  id?: string
}

export function Chat({ id, initialMessages, className }: ChatProps) {
  const [previewToken, setPreviewToken] = useLocalStorage<string | null>(
    'ai-token',
    null
  )
  const [previewTokenDialog, setPreviewTokenDialog] = useState(IS_PREVIEW)
  const [previewTokenInput, setPreviewTokenInput] = useState(previewToken ?? '')
  const [streamingReply, setStreamingReply] = useState('')

  const { messages, append, reload, stop, isLoading, input, setInput } =
    useChat({
      initialMessages,
      id,
      body: {
        id,
        previewToken
      },
      async onResponse(response) {
        if (response.status === 401) {
          toast.error(response.statusText)
          return
        }
        if (response.body) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let assistantText = ''
          setStreamingReply('')
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value)
            for (const line of chunk.split('\n')) {
              if (!line.trim()) continue
              try {
                const event = JSON.parse(line)
                if (event.type === 'content_block_delta' && event.delta?.text) {
                  assistantText += event.delta.text
                  setStreamingReply(prev => prev + event.delta.text)
                }
              } catch (err) {
                // Ignore non-JSON lines
              }
            }
          }
          // Add the full reply to chat history
          if (assistantText) {
            append({
              id: Math.random().toString(36).slice(2),
              role: 'assistant',
              content: assistantText
            })
          }
          setStreamingReply('')
        }
      },
      async onFinish() {
        setInput('')
      }
    })

  return (
    <>
      <div className={cn('pb-[200px] pt-4 md:pt-10', className)}>
        <ChatList messages={messages} />
        {isLoading && streamingReply && (
          <div className="mx-auto max-w-2xl px-4">
            <div className="chatbox-message ml-4 flex-1 space-y-2 overflow-hidden px-1">
              <div className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0">
                {streamingReply}
              </div>
            </div>
          </div>
        )}
        <ChatScrollAnchor trackVisibility={isLoading} />
      </div>

      <ChatPanel
        id={id}
        isLoading={isLoading}
        stop={stop}
        append={append}
        reload={reload}
        messages={messages}
        input={input}
        setInput={setInput}
      />

      <Dialog open={previewTokenDialog} onOpenChange={setPreviewTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter your OpenAI Key</DialogTitle>
            <DialogDescription>
              If you have not obtained your OpenAI API key, you can do so by{' '}
              <a
                href="https://platform.openai.com/signup/"
                className="underline"
              >
                signing up
              </a>{' '}
               on the OpenAI website. This is only necessary for preview
              environments so that the open source community can test the app.
              The token will be saved to your browser&apos;s local storage under
              the name <code className="font-mono">ai-token</code>.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={previewTokenInput}
            placeholder="OpenAI API key"
            onChange={e => setPreviewTokenInput(e.target.value)}
          />
          <DialogFooter className="items-center">
            <Button
              onClick={() => {
                setPreviewToken(previewTokenInput)
                setPreviewTokenDialog(false)
              }}
            >
              Save Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}