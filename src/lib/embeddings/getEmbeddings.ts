import type { Embeddings } from "@langchain/core/embeddings";

let cached: Promise<{ embeddings: Embeddings; dimension: number }> | null = null;

/**
 * Returns the embeddings implementation for the current environment.
 * Production: OpenAI. Development: Ollama.
 * Uses dynamic import so only the chosen provider is loaded at runtime.
 */
export async function getEmbeddings(): Promise<Embeddings> {
  const resolved = await getEmbeddingsWithDimension();
  return resolved.embeddings;
}

/**
 * Returns the embedding dimension for the current provider (1536 for both OpenAI and Ollama when dimensions param is set).
 */
export async function getEmbeddingDimension(): Promise<number> {
  const resolved = await getEmbeddingsWithDimension();
  return resolved.dimension;
}

async function getEmbeddingsWithDimension(): Promise<{
  embeddings: Embeddings;
  dimension: number;
}> {
  if (cached !== null) {
    return cached;
  }
  if (process.env.NODE_ENV === "production") {
    const mod = await import("./providers/openai.js");
    const embeddings = mod.createEmbeddings();
    cached = Promise.resolve({
      embeddings,
      dimension: mod.OPENAI_EMBEDDING_DIM,
    });
  } else {
    const mod = await import("./providers/ollama.js");
    const embeddings = mod.createEmbeddings();
    cached = Promise.resolve({
      embeddings,
      dimension: mod.OLLAMA_EMBEDDING_DIM,
    });
  }
  return cached;
}
