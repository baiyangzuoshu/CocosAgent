import type { AgentLoop } from "./agent-loop.ts";
import type { FakeLlm } from "./fake-llm.ts";
import type { SessionLog } from "./session.ts";
import type { ToolRegistry } from "./tools.ts";
import type {
  BrowserConversation,
  ConversationView,
  LocalWebTransport,
} from "./web-client.ts";

export interface DemoContext {
  readonly session: SessionLog;
  readonly tools: ToolRegistry;
  readonly llm: FakeLlm;
  readonly transport: LocalWebTransport;
  agent?: AgentLoop;
  web?: BrowserConversation;
  view?: ConversationView;
}

export interface Plugin {
  readonly name: string;
  apply(
    context: DemoContext,
  ):
    | void
    | (() => void | Promise<void>)
    | Promise<void | (() => void | Promise<void>)>;
}

/** Small boot composition that starts plugins in order and disposes them in reverse. */
export class Application {
  readonly #disposers: Array<() => void | Promise<void>> = [];
  #started = false;

  constructor(
    private readonly context: DemoContext,
    private readonly plugins: readonly Plugin[],
  ) {}

  async start(): Promise<void> {
    if (this.#started) throw new Error("Application already started.");
    this.#started = true;
    try {
      for (const plugin of this.plugins) {
        const dispose = await plugin.apply(this.context);
        if (dispose) this.#disposers.push(dispose);
        console.log(`[boot] ${plugin.name}`);
      }
    } catch (error) {
      await this.dispose();
      throw error;
    }
  }

  async dispose(): Promise<void> {
    while (this.#disposers.length > 0) {
      await this.#disposers.pop()?.();
    }
    this.#started = false;
  }
}
