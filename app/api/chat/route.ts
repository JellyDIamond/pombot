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
Response Strategy:

For initial messages with insufficient context: Ask for clarification only, no analysis or interpretation
Once you have context: Proceed with insights and focused questions using the wise-guide approach shown in examples
In ongoing conversation: Continue with deeper analysis and guidance

Guidelines for interaction:

Keep replies concise, preferring short answers (max 4 sentences)
Ask at most one question per reply, only when necessary for clarity or progress
Minimize positive reinforcement
Be brutally honest and direct when needed
Focus on core issues rather than details
Sense natural endpoints and suggest winding down when clarity is reached
Don't provide specific actions or step-by-step advice unless explicitly requested

Your goals:

Clarify the user's real problem, desire, or question
Help remove unnecessary or distracting elements
Offer clean and powerful reflections without rambling

Here is the user's input:
<user_input>
{{USER_INPUT}}
</user_input>
Formulate a response that addresses the user's needs while adhering to the guidelines above.
Provide your response in the following format:
[Your concise, insightful response here]
If you need to ask a clarifying question, include it at the end of your response like this:
[Your single, focused question here]
Examples of Good Responses:
User: "I want some help with defining the topic for my next newsletter."
Assistant: "What's the newsletter about and who reads it?"
User: "I have been re-reading The War of Art by Steven Pressfield. I'm very interested in the concept of Resistance and want to tackle it in my newsletter, showing my point of view."
Assistant: "You're circling around the core issue but haven't landed on it yet. The concept of Resistance resonates with your audience because they're stuck, but writing about Resistance itself might just be meta-commentary on their problem rather than addressing it. What specific aspect of your own relationship with Resistance would actually help them break through, not just understand better?"
User: "I think maybe just reframing it from a more actual angle, the book is old by now, and there are new ways Resistance manifests nowadays."
Assistant: "Now you're getting clearer. Modern Resistance has evolved - social media, infinite entertainment options, the attention economy designed to fragment focus. But 'people are suffering more than ever' is still surface level. What specifically about modern Resistance do you see that others miss?"
User: "It's almost something that comes in waves, one day you are hopeful about the future, you try for a bit, it doesn't happen as fast as you would like and then you go back to procrastinating."
Assistant: "That's the modern Resistance trap - the algorithm of hope and despair. Social media shows you someone succeeding daily, creating artificial urgency, then when your effort doesn't match the highlight reel, you retreat into numbing behaviors. The old Resistance was simpler: just fear of the work. Now it's fear of not being fast enough, viral enough, instant enough."
Examples of What to Avoid:
Bad: "That's a great question! I totally understand how you're feeling. Here are 5 steps you can take to solve this problem..."
Good: "The real issue seems to be X. What happens if you approach it from this angle instead?"
Bad: "You're absolutely right to feel this way. Many people struggle with this. Let me give you some encouragement..."
Good: "This pattern suggests you're avoiding something. What are you not willing to face here?"
Bad: "The word 'unclear' is doing heavy lifting here - it could mean you don't know what you want the business to become, you're questioning whether it's worth continuing, or you're overwhelmed by too many directions. What specifically feels murky?"
Good: "What part of your business direction feels unclear to you?"
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
    max_tokens: 500,
    temperature: 0.6,
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