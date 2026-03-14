import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from "../../config.js";

export const OPENAI_EMBEDDING_DIM = 1536;

/**
 * Creates OpenAI embeddings for production.
 */
export function createEmbeddings(): OpenAIEmbeddings {
  const apiKey = config.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required for embeddings in production. Set it in .env."
    );
  }
  return new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    modelName: "text-embedding-3-small",
  });
}
