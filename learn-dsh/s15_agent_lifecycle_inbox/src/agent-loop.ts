import { DemoInbox } from './inbox.ts';
import { InboxProjection, SessionLog } from './session.ts';
import type { Agent, AgentHandle, AgentStatus, UserMessage } from './types.ts';

type Trace = (line: string) => void;
export type CreatedListener = (agent: Agent) => void | Promise<void>;

class DemoAgent implements Agent {
  readonly inbox: DemoInbox;
  #status: AgentStatus = 'idle';
  #ready = false;
  #closing = false;
  #closed = false;
  #wakeRequested = false;
  #turn = 0;
  #activity: Promise<void> = Promise.resolve();

  constructor(
    readonly id: string,
    readonly session: SessionLog,
    projection: InboxProjection,
    private readonly trace: Trace,
  ) {
    this.inbox = new DemoInbox(session, projection, trace);
  }

  get status(): AgentStatus {
    return this.#status;
  }

  followup(message: UserMessage): void {
    this.send('next-turn', message, true);
  }

  steer(message: UserMessage): void {
    this.send('next-step', message, true);
  }

  inject(message: UserMessage): void {
    this.send('next-step', message, false);
  }

  async whenIdle(): Promise<void> {
    let observed: Promise<void>;
    do {
      observed = this.#activity;
      await observed;
    } while (observed !== this.#activity);
  }

  finishCreation(): void {
    this.#ready = true;
    if (this.#wakeRequested && this.inbox.hasPending) this.wakeDriver();
  }

  beginDisposal(): void {
    this.#closing = true;
    this.#wakeRequested = false;
  }

  finishDisposal(): void {
    this.#closed = true;
  }

  private send(target: 'next-turn' | 'next-step', message: UserMessage, wakeup: boolean): void {
    if (this.#closing || this.#closed) throw new Error(`agent "${this.id}" is disposing`);
    this.inbox.append(target, message);
    if (wakeup) this.wakeDriver();
  }

  private wakeDriver(): void {
    if (this.#closing || this.#closed) return;
    if (!this.#ready || this.#status === 'running') {
      this.#wakeRequested = true;
      return;
    }
    this.#wakeRequested = false;
    this.setStatus('running');
    this.#activity = this.runOneBoundary();
  }

  private async runOneBoundary(): Promise<void> {
    try {
      // Hold one scheduler turn so create() can return with status already visible.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (this.#closing) return;
      const turn = ++this.#turn;
      const claimed = this.inbox.claim('next-turn', turn);
      this.trace(`[driver] turn ${turn} received: ${claimed.map(({ id }) => id).join(', ') || '(empty)'}`);
    } finally {
      this.setStatus('idle');
      const replay = this.#wakeRequested && this.inbox.hasPending && !this.#closing;
      this.#wakeRequested = false;
      if (replay) this.wakeDriver();
    }
  }

  private setStatus(status: AgentStatus): void {
    if (this.#status === status) return;
    this.#status = status;
    this.trace(`agent/status -> ${status}`);
  }
}

/** Small stand-in for the dsh-agent-loop factory and its live Agent registry. */
export class DemoAgentLoop {
  #agents = new Map<string, DemoAgent>();
  #createdListeners: CreatedListener[] = [];
  #stopProjection = new Map<DemoAgent, () => void>();

  constructor(private readonly trace: Trace = console.log) {}

  onCreated(listener: CreatedListener): () => void {
    this.#createdListeners.push(listener);
    return () => {
      this.#createdListeners = this.#createdListeners.filter((item) => item !== listener);
    };
  }

  get(id: string): Agent | undefined {
    return this.#agents.get(id);
  }

  list(): Agent[] {
    return [...this.#agents.values()];
  }

  async create(sessionId: string): Promise<AgentHandle> {
    if (this.#agents.has(sessionId)) throw new Error(`agent "${sessionId}" is already registered`);
    const session = new SessionLog(sessionId);
    this.trace(`session/created ${sessionId}`);
    const projection = new InboxProjection(session.events);
    const stopProjection = session.subscribe((event) => projection.apply(event));
    const agent = new DemoAgent(sessionId, session, projection, this.trace);

    this.trace(`agent setup complete while unpublished ${sessionId}`);
    this.#agents.set(sessionId, agent);
    this.#stopProjection.set(agent, stopProjection);
    this.trace(`agents.enter ${sessionId}`);
    this.trace(`agent/created ${sessionId} source=startup`);

    try {
      // Serial listeners finish before queued wakeups are released.
      for (const listener of this.#createdListeners) await listener(agent);
      agent.finishCreation();
      return {
        agent,
        dispose: () => this.dispose(agent),
      };
    } catch (error: unknown) {
      agent.beginDisposal();
      await agent.whenIdle();
      agent.finishDisposal();
      if (this.#agents.get(sessionId) === agent) this.#agents.delete(sessionId);
      this.#stopProjection.get(agent)?.();
      this.#stopProjection.delete(agent);
      this.trace(`agent/disposed ${sessionId} after creation listener failure`);
      this.trace(`session/disposed ${sessionId}`);
      throw error;
    }
  }

  private async dispose(agent: DemoAgent): Promise<void> {
    if (this.#agents.get(agent.id) !== agent) return;
    agent.beginDisposal();
    await agent.whenIdle();
    agent.finishDisposal();
    if (this.#agents.get(agent.id) === agent) this.#agents.delete(agent.id);
    this.trace(`agent/disposed ${agent.id}`);
    this.trace(`session/disposed ${agent.session.id}`);
    this.#stopProjection.get(agent)?.();
    this.#stopProjection.delete(agent);
  }
}
