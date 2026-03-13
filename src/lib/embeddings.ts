import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from "./config.js";

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: config.OPENAI_API_KEY,
  modelName: "text-embedding-3-small",
});

const EMBEDDING_DIM = 1536;

export async function computeEmbedding(text: string): Promise<number[]> {
  const result = await embeddings.embedQuery(text);
  if (result.length !== EMBEDDING_DIM) {
    throw new Error(
      `Unexpected embedding dimension: ${result.length}, expected ${EMBEDDING_DIM}`
    );
  }
  return result;
}
