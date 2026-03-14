import { getEmbeddings, getEmbeddingDimension } from "./getEmbeddings.js";

/**
 * Computes the embedding vector for the given text using the current provider
 * (Ollama in development, OpenAI in production).
 */
export async function computeEmbedding(text: string): Promise<number[]> {
  const embeddings = await getEmbeddings();
  const result = await embeddings.embedQuery(text);
  const expectedDim = await getEmbeddingDimension();
  if (result.length !== expectedDim) {
    throw new Error(
      `Unexpected embedding dimension: ${result.length}, expected ${expectedDim}`
    );
  }
  return result;
}

export { getEmbeddings, getEmbeddingDimension };
