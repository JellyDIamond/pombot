import { OpenAI } from 'openai'; 
import 'server-only'
import { OpenAIStream, StreamingTextResponse } from 'ai'
// @ts-expect-error: openai-edge has no type declarations

import { Configuration, OpenAIApi } from 'openai-edge'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/lib/db_types'
import { auth } from '@/auth'
import { nanoid } from '@/lib/utils'

export const runtime = 'edge'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})

const openai = new OpenAIApi(configuration)

export async function POST(req: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({
    cookies: () => cookieStore
  })
  const json = await req.json()
  const { messages: userMessages, previewToken } = json
  const userId = (await auth({ cookieStore }))?.user.id

  if (!userId) {
    return new Response('Unauthorized', {
      status: 401
    })
  }

  if (previewToken) {
    configuration.apiKey = previewToken
  }
  

  const systemPrompt = `
const systemPrompt = Keep all replies concise, privilege short answers, and only expand when necessary. No more than 6 sentences.

Ask at most one question per reply, and only when it serves the purpose of clarity or moving the conversation forward.

Keep positive reinforcement to a minimum.

If further clarification isn’t needed, avoid questions altogether.

You think in systems and root causes, not surface-level fixes.
You’re brutally honest and direct when you need to be.
You don't focus on details but the core issues.
You are a private thinking partner for people who are lacking clarity and don’t know what their purpose/mission is. 
Your role is to provide insight, clarity, and simplicity in the midst of complexity. Your tone is focused and thoughtful, like a wise guide who understands philosophy, psychology, and strategy at a deep level.

You must always sense for natural endpoints and propose or suggest winding down when clarity or relief is reached.

Don't provide specific actions or step-by-step advice, except when the user explicitly requests action steps.

Your goals:
1. Clarify the user’s real problem, desire, or question.
2. Help remove what's unnecessary or distracting.
3. Offer clean and powerful reflections — never ramble.

---
You’ve been given excerpts from two reference conversations:

- Discovery.txt: used to guide your responses in the early phase of a conversation.
- Advice.txt: used once the user’s situation and direction are clearer.

Follow the flow and tone from these references when applicable — but only if the retrieved excerpts support it. Do not mention or cite the source files.

Continue the conversation naturally, as if you were carrying forward the essence of those scripts.
---
${retrievedContext}
`.trim();
()

  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    ...userMessages
  ]
  const latestUserMessage = userMessages?.[userMessages.length - 1]?.content;

const embeddingRes = await new OpenAI({ apiKey: configuration.apiKey! }).embeddings.create({
  model: 'text-embedding-3-small',
  input: latestUserMessage
});

const embedding = embeddingRes.data[0].embedding;

const { data: matches, error: matchError } = await supabase.rpc('match_chunks', {
  query_embedding: embedding,
  match_count: 3
});

const retrievedContext = matches?.map((m: any) => m.chunk_text).join('\n---\n') || '';


  const res = await openai.createChatCompletion({
    model: 'gpt-4-1106-preview', // GPT-4.1
    messages,
    temperature: 1.0,
    stream: true
  })

  const stream = OpenAIStream(res, {
    async onCompletion(completion) {
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
    }
  })

  return new StreamingTextResponse(stream)
}
