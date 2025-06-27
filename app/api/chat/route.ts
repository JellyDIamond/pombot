import 'server-only'
import { OpenAIStream, StreamingTextResponse } from 'ai'
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

  const advice = `User:
I’m honestly really confused right now. But definitely not at work.
AI:
That confusion makes sense. And it doesn’t mean you’re lost— you are only struggling because you want to be better, and that’s good.
...You're closer than you think.`

  const discovery = `User:
I feel like my job is meaningless, and I don't know what to do.
AI:
That sounds heavy. When you say “meaningless,” what does that actually feel like on a normal day? Where do you notice it most?
...Is there any area, outside of work, where you could start building that kind of progress again?`

  const systemPrompt = `
Keep all replies concise, privilege short answers, and only expand when necessary. No more than 6 sentences.

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
Reference Notes:

Advice:
${advice}

Discovery:
${discovery}

Use these references to inform your answers when relevant. Do not mention these files directly to the user.
`.trim()

  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    ...userMessages
  ]

  const res = await openai.createChatCompletion({
    model: 'gpt-4-1106-preview', // GPT-4.1
    messages,
    temperature: 0.7,
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
