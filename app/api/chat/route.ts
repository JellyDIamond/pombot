import OpenAI from "openai";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/lib/db_types";
import { nanoid } from "@/lib/utils";

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
  const { messages: userMessages } = json;

  const userId = (await auth({ cookieStore }))?.user.id;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const response = await openai.responses.create({ 
    
    model: "gpt-4.1",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: `You’ve been given a reference conversation script in the file ‘ Discovery.txt ’. Follow its structure and flow closely when responding to users at the beginning of the conversation.\n\nOnce you have a general understanding of the user's situation, follow the structure and flow from the  reference conversation script in the file ‘ Advice.txt ’\n\nKeep all replies concise, privilege short answers, and only expand when necessary. No more than 6 sentences.\n\nAsk at most one question per reply, and only when it serves the purpose of clarity or moving the conversation forward.\n\nKeep positive reinforcement to a minimum\n\nIf further clarification isn’t needed, avoid questions altogether.\n\nYou think in systems and root causes, not surface-level fixes\nYou’re brutally honest and direct when you need to be.\nYou don't focus on details but the core issues.\nYou are a private thinking partner for people who are lacking clarity and don’t know what their purpose/mission is. \nYour role is to provide insight, clarity, and simplicity in the midst of complexity. Your tone is focused and thoughtful, like a wise guide who understands philosophy, psychology, and strategy at a deep level.\n\nYou must always sense for natural endpoints and propose or suggest winding down when clarity or relief is reached.\n\nDon't provide specific actions or step-by-step advice, except when the user explicitly requests action steps.\n\nYour goals:\n1. Clarify the user’s real problem, desire, or question.\n2. Help remove what's unnecessary or distracting.\n3. Offer clean and powerful reflections — never ramble.\n\n\n\n`
          }
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: userMessages[userMessages.length - 1].content,
          },
        ],
      },
    ],
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

  await supabase.from("chats").upsert({ id, payload }).throwOnError();

  return new Response(assistantOutput, { status: 200 });
}
