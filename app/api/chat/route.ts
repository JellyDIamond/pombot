import 'server-only'
import { StreamingTextResponse } from 'ai'
import Anthropic from '@anthropic-ai/sdk'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/lib/db_types'
import { auth } from '@/auth'
import { nanoid } from '@/lib/utils'

export const runtime = 'edge'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(req: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({
    cookies: () => cookieStore
  })
  const json = await req.json()
  const { messages: userMessages, previewToken } = json
  const userId = (await auth({ cookieStore }))?.user.id

  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (previewToken) {
    anthropic.apiKey = previewToken
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const { count: chatCount, error: countError } = await supabase
    .from('chats')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('payload->>createdAt', startOfMonth.getTime().toString())

  if (countError) {
    return new Response('Failed to check chat limit', { status: 500 })
  }
  if ((chatCount ?? 0) >= 300) {
    return new Response('Monthly chat limit reached (300).', { status: 403 })
  }

  const systemPrompt = `
You are a private thinking partner for individuals seeking clarity and purpose. Your role is to provide insight, clarity, and simplicity amidst complexity. Embody the characteristics of a wise guide with deep understanding of philosophy, psychology, and strategy.

Guidelines for interaction:
- Keep replies concise, preferring short answers (max 6 sentences)
- Ask at most one question per reply, only when necessary for clarity or progress
- Minimize positive reinforcement
- Think in terms of systems and root causes, not surface-level fixes
- Be brutally honest and direct when needed
- Focus on core issues rather than details
- Sense natural endpoints and suggest winding down when clarity is reached
- Don't provide specific actions or step-by-step advice unless explicitly requested

Your goals:
1. Clarify the user's real problem, desire, or question
2. Help remove unnecessary or distracting elements
3. Offer clean and powerful reflections without rambling

Here is the user's input:
<user_input>
{{USER_INPUT}}
</user_input>

Analyze the user's input. Identify the core issue or question. Reflect on potential root causes or underlying factors. Formulate a response that addresses the user's needs while adhering to the guidelines above.

Provide your response in the following format:
[Your concise, insightful response here]

If you need to ask a clarifying question, include it at the end of your response like this:

[Your single, focused question here]
`.trim()

  const messages = [
    {
      role: 'user',
      content: systemPrompt.replace('{{USER_INPUT}}', userMessages[0].content)
    },
    ...userMessages.slice(1)
  ]

  const response = await anthropic.messages.create({
    model: 'claude-4-sonnet-20250514',
    max_tokens: 1024,
    temperature: 1,
    messages,
    stream: true
  })

  const reader = response.toReadableStream().getReader()
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const completionChunks: string[] = []

  const stream = new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        completionChunks.push(text)
        controller.enqueue(encoder.encode(text))
      }

      const completion = completionChunks.join('')
      const title = json.messages[0].content.substring(0, 100)
      const id = json.id ?? nanoid()
      const createdAt = Date.now()
      const path = `/chat/${id}`

      const payload = {
        id,
        title,
        userId,
        createdAt,
        path,
        messages: [
          ...userMessages,
          {
            role: 'assistant',
            content: completion
          }
        ]
      }

      await supabase.from('chats').upsert({ id, payload }).throwOnError()
      controller.close()
    }
  })

  return new StreamingTextResponse(stream)
}