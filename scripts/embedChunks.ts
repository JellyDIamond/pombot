import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
console.log('Loaded env:', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
});


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function chunkText(text: string, maxWords = 200): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '));
  }
  return chunks;
}

async function embedAndUpload(source: string, filepath: string) {
  const text = fs.readFileSync(filepath, 'utf8');
  const chunks = chunkText(text);

  for (const chunk of chunks) {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk
    });

    const [{ embedding }] = embeddingResponse.data;

    const { error } = await supabase.from('file_chunks').insert({
      source,
      chunk_text: chunk,
      embedding
    });

    if (error) {
      console.error(`❌ Error inserting chunk:`, error);
    } else {
      console.log(`✅ Uploaded chunk from ${source}`);
    }
  }
}

async function run() {
  await embedAndUpload('Advice.txt', './Advice.txt');
  await embedAndUpload('Discovery.txt', './Discovery.txt');
}

run();
