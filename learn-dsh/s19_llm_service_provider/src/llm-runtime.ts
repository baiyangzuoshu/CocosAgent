import type { GenerateOptions, LlmAdapter, ProviderInfo, StreamChunk } from './types.ts';

interface Registration {
  readonly adapter: LlmAdapter;
  readonly info: ProviderInfo;
}

/** Small analogue of ctx.llm: a provider-route registry plus one stream entry. */
export class LlmRuntime {
  #routes = new Map<string, Registration>();

  registerAdapter(providers: readonly string[], adapter: LlmAdapter): () => void {
    if (providers.length === 0) throw new Error('an adapter must register at least one provider');
    const unique = new Set<string>();
    const prepared: Registration[] = [];
    for (const provider of providers) {
      if (provider.length === 0) throw new Error('provider names must not be empty');
      if (unique.has(provider) || this.#routes.has(provider)) {
        throw new Error(`adapter route already registered: ${provider}`);
      }
      const info = adapter.providerInfo(provider);
      if (info.id !== provider || info.name.length === 0) throw new Error(`invalid provider metadata for ${provider}`);
      unique.add(provider);
      prepared.push({ adapter, info: { ...info } });
    }
    for (const registration of prepared) this.#routes.set(registration.info.id, registration);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      for (const provider of unique) {
        if (this.#routes.get(provider)?.adapter === adapter) this.#routes.delete(provider);
      }
    };
  }

  listProviders(): ProviderInfo[] {
    return [...this.#routes.values()].map(({ info }) => ({ ...info }));
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const registration = this.#routes.get(options.provider);
    if (registration === undefined) {
      yield {
        type: 'finish',
        reason: { kind: 'error', failure: { code: 'NO_ADAPTER', message: `no adapter for ${options.provider}` } },
      };
      return;
    }

    try {
      yield* registration.adapter.stream(options);
    } catch (error: unknown) {
      yield {
        type: 'finish',
        reason: {
          kind: 'error',
          failure: { code: 'UNKNOWN', message: error instanceof Error ? error.message : String(error) },
        },
      };
    }
  }
}
