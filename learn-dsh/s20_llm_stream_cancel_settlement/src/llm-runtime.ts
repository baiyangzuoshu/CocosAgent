import type {
  GenerateOptions,
  LlmAdapter,
  LlmFailure,
  StreamChunk,
} from "./types.ts";

/** Minimal provider router; adapter exceptions become one terminal finish chunk. */
export class LlmRuntime {
  #adapters = new Map<string, LlmAdapter>();

  registerAdapter(provider: string, adapter: LlmAdapter): () => void {
    if (provider.length === 0) throw new Error("provider must not be empty");
    if (this.#adapters.has(provider)) {
      throw new Error(`provider already registered: ${provider}`);
    }
    this.#adapters.set(provider, adapter);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (this.#adapters.get(provider) === adapter) {
        this.#adapters.delete(provider);
      }
    };
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const adapter = this.#adapters.get(options.provider);
    if (adapter === undefined) {
      yield {
        type: "finish",
        reason: {
          kind: "error",
          failure: {
            code: "NO_ADAPTER",
            message: `no adapter for ${options.provider}`,
          },
        },
      };
      return;
    }

    let iterator: AsyncIterator<StreamChunk>;
    try {
      iterator = adapter.stream(options)[Symbol.asyncIterator]();
    } catch (error: unknown) {
      yield failureChunk(error, options.signal);
      return;
    }

    let completed = false;
    try {
      while (true) {
        let item: IteratorResult<StreamChunk>;
        try {
          item = await iterator.next();
        } catch (error: unknown) {
          completed = true;
          yield failureChunk(error, options.signal);
          return;
        }
        if (item.done) {
          completed = true;
          return;
        }
        // Keep yield outside the adapter catch: consumer errors are not provider failures.
        yield item.value;
      }
    } finally {
      if (!completed) await iterator.return?.();
    }
  }
}

function failureChunk(error: unknown, signal: AbortSignal): StreamChunk {
  const failure: LlmFailure = {
    code: signal.aborted ? "ABORTED" : "UNKNOWN",
    message: error instanceof Error ? error.message : String(error),
  };
  return {
    type: "finish",
    reason: signal.aborted
      ? { kind: "aborted", failure }
      : { kind: "error", failure },
  };
}
