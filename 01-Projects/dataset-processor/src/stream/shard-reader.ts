/**
 * Shard Reader — streams .jsonl.zst files line-by-line without loading full shard into memory.
 *
 * Uses the zstd binary for decompression (streaming via subprocess stdout),
 * then splits on newlines for JSONL parsing. Memory usage stays bounded
 * regardless of shard size.
 */

import { spawn } from "bun";

export interface PileDocument {
  text: string;
  meta: {
    pile_set_name: string;
    [key: string]: unknown;
  };
}

export interface ShardDocument {
  doc: PileDocument;
  lineNumber: number;
  shardPath: string;
}

/**
 * Stream documents from a .jsonl.zst shard file.
 * Decompresses via zstd subprocess and yields parsed documents one at a time.
 */
export async function* streamShard(
  shardPath: string,
  options?: {
    componentFilter?: string;
    maxDocuments?: number;
  }
): AsyncGenerator<ShardDocument> {
  const proc = spawn(["zstd", "-d", "-c", shardPath], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lineNumber = 0;
  let emitted = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        lineNumber++;

        if (line.length === 0) continue;

        try {
          const doc = JSON.parse(line) as PileDocument;

          // Component filter: skip documents not from the target component
          if (
            options?.componentFilter &&
            doc.meta.pile_set_name !== options.componentFilter
          ) {
            continue;
          }

          emitted++;
          yield { doc, lineNumber, shardPath };

          if (options?.maxDocuments && emitted >= options.maxDocuments) {
            proc.kill();
            return;
          }
        } catch {
          // Skip malformed JSON lines
          continue;
        }
      }
    }

    // Handle any remaining data in buffer
    if (buffer.trim().length > 0) {
      lineNumber++;
      try {
        const doc = JSON.parse(buffer) as PileDocument;
        if (
          !options?.componentFilter ||
          doc.meta.pile_set_name === options.componentFilter
        ) {
          yield { doc, lineNumber, shardPath };
        }
      } catch {
        // Skip malformed final line
      }
    }
  } finally {
    reader.releaseLock();
    proc.kill();
  }
}

/**
 * Count documents in a shard without full processing.
 * Useful for progress reporting.
 */
export async function countShardDocuments(
  shardPath: string,
  componentFilter?: string
): Promise<number> {
  let count = 0;
  for await (const _ of streamShard(shardPath, { componentFilter })) {
    count++;
  }
  return count;
}
