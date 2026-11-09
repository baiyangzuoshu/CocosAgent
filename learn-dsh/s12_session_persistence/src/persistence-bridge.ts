import type { JsonlSessionHandle } from './jsonl-store.ts';
import type { SessionEvent } from './types.ts';
import type { SessionLog } from './session-log.ts';

/** Models the backend's synchronous session/event queue and explicit flush barrier. */
export class PersistenceBridge {
  private readonly pending: SessionEvent[] = [];
  private readonly unsubscribe: () => void;

  constructor(private readonly session: SessionLog, private readonly handle: JsonlSessionHandle) {
    this.unsubscribe = session.subscribe((event) => {
      this.pending.push(structuredClone(event));
    });
  }

  get bufferedCount(): number {
    return this.pending.length;
  }

  async flush(): Promise<void> {
    const batch = this.pending.splice(0);
    if (batch.length > 0) {
      try {
        await this.handle.append(batch);
      } catch (error) {
        this.pending.unshift(...batch);
        throw error;
      }
    }
    await this.handle.flush();
  }

  async close(): Promise<void> {
    await this.flush();
    this.unsubscribe();
    await this.handle.close();
  }
}
