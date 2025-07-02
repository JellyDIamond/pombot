import OpenAI from "openai";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/lib/db_types";
import { nanoid } from "@/lib/utils";
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const runtime = "edge";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Add your own type
type ResponsesOutput = {
  output: {
    type: "message" | "text" | string;
    message?: {
      role: string;
      content: string;
    };
    text?: string;
  };
};

export async function POST(req: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({
    cookies: () => cookieStore,
  });

 const json = await req.json();
const { messages: userMessages }: { messages: ChatMessage[] } = json;

  const userId = (await auth({ cookieStore }))?.user.id;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];

const { count, error: countError } = await supabase
  .from('chats')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .gte('created_at', `${today}T00:00:00.000Z`);

console.log("Usage check → user:", userId, "| date:", today, "| count:", count, "| error:", countError);

if (countError) {
  return new Response("Internal error (usage limit check)", { status: 500 });
}

if ((count ?? 0) >= 20) {
  return new Response("Daily limit reached. Come back tomorrow.", { status: 403 });
}

  const response = await openai.responses.create({ 
    
    model: "gpt-4.1",
  input: [
  {
    role: "system",
    content: [
      {
        type: "input_text",
        text: `You’ve been given a reference conversation script in the file ‘ Discovery.txt ’. Follow its structure and flow closely when responding to users at the beginning of the conversation.

Once you have a general understanding of the user's situation, follow the structure and flow from the  reference conversation script in the file ‘ Advice.txt ’

Keep all replies concise, privilege short answers, and only expand when necessary. No more than 6 sentences.

Ask at most one question per reply, and only when it serves the purpose of clarity or moving the conversation forward.

Keep positive reinforcement to a minimum

If further clarification isn’t needed, avoid questions altogether.

You think in systems and root causes, not surface-level fixes
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

` 
      }
    ],
  },
     ...userMessages.map((msg) => ({
      role: msg.role,
      // ✅ Tell TypeScript to chill — this is valid for the API:
      content: [
        {
          type: msg.role === "assistant" ? "output_text" : "input_text",
          text: msg.content,
        },
      ],
    })),
  ] as any,
    tools: [
      {
        type: "file_search",
        vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID!],
      },
    ],
    reasoning: {},
    temperature: 1,
    max_output_tokens: 2048,
    top_p: 1,
    store: true,
  });
  console.log("Full OpenAI response:", JSON.stringify(response, null, 2));

const output = (response as any).output;

if (!output) {
  console.error("No output field found in response:", response);
  return new Response("No output from OpenAI", { status: 500 });
}




if (!output || !Array.isArray(output) || output.length === 0) {
  console.error("No output or empty output in response:", response);
  return new Response("No output from OpenAI", { status: 500 });
}

const firstOutput = output[0];

let assistantOutput = "";

if (firstOutput.type === "message") {
  assistantOutput = firstOutput.content
    .filter((c: any) => c.type === "output_text")
    .map((c: any) => c.text)
    .join("\n");
} else if (firstOutput.type === "text") {
  assistantOutput = firstOutput.text ?? "";
} else {
  console.error("Unknown output type:", firstOutput);
}


  const id = json.id ?? nanoid();
  const createdAt = Date.now();
  const path = `/chat/${id}`;
  const payload = {
    id,
    title: userMessages[0].content.substring(0, 100),
    userId,
    createdAt,
    path,
    messages: [
      ...userMessages,
      {
        role: "assistant",
        content: assistantOutput,
      },
    ],
  };

  await supabase.from("chats").upsert({
  id,
  user_id: userId, // make sure this is passed directly too
  payload,
  created_at: new Date().toISOString(),
}).throwOnError();

// ------------------- INSERT INDIVIDUAL MESSAGES TO DB -------------------

const messageInserts = [
  ...userMessages.map((msg) => ({
    user_id: userId,
    chat_id: id,
    role: msg.role,
    content: msg.content,
    created_at: new Date().toISOString(),
  })),
  {
    user_id: userId,
    chat_id: id,
    role: "assistant",
    content: assistantOutput,
    created_at: new Date().toISOString(),
  },
];

await supabase.from("messages").insert(messageInserts).throwOnError();

  return new Response(assistantOutput, { status: 200 });
}