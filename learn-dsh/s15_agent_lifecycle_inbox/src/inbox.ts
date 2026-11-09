import type { Inbox, InboxState, InboxTarget, UserMessage } from './types.ts';
import { InboxProjection, SessionLog } from './session.ts';

type Trace = (line: string) => void;

/** Driver-owned inbox; each mutation is committed before its live notification. */
export class DemoInbox implements Inbox {
  constructor(
    private readonly session: SessionLog,
    private readonly projection: InboxProjection,
    private readonly trace: Trace,
  ) {}

  get nextTurn(): readonly UserMessage[] {
    return this.projection.snapshot().nextTurn;
  }

  get nextStep(): readonly UserMessage[] {
    return this.projection.snapshot().nextStep;
  }

  get hasPending(): boolean {
    const state = this.projection.snapshot();
    return state.nextTurn.length > 0 || state.nextStep.length > 0;
  }

  append(target: InboxTarget, message: UserMessage): void {
    this.mutate(target, this.targetItems(target).length, 0, [message], false);
  }

  clear(): void {
    this.mutate('next-step', 0, this.nextStep.length, [], true);
    this.mutate('next-turn', 0, this.nextTurn.length, [], true);
  }

  /** Internal loop seam: next-step input precedes one next-turn prompt. */
  claim(target: InboxTarget, turn: number): UserMessage[] {
    const claimed = this.mutate('next-step', 0, this.nextStep.length, [], false);
    if (target === 'next-turn') claimed.push(...this.mutate('next-turn', 0, 1, [], false));
    for (const message of claimed) {
      this.trace(`agent/inbox/claimed ${message.id} turn=${turn}`);
    }
    return claimed;
  }

  private read(): InboxState {
    return this.projection.snapshot();
  }

  private targetItems(target: InboxTarget): readonly UserMessage[] {
    const state = this.read();
    return target === 'next-turn' ? state.nextTurn : state.nextStep;
  }

  private mutate(
    target: InboxTarget,
    start: number,
    removedCount: number,
    inserted: UserMessage[],
    discarded: boolean,
  ): UserMessage[] {
    if (removedCount === 0 && inserted.length === 0) return [];
    const before = this.targetItems(target);
    const removed = before.slice(start, start + removedCount);
    const event = this.session.appendInboxSplice({
      target,
      start,
      ...(removedCount === 0 ? {} : { removedCount }),
      inserted,
      ...(discarded && removedCount > 0 ? { outcome: 'canceled' as const } : {}),
    });
    this.trace(`session: agent/inbox/spliced@${event.seq} target=${target} removed=${removedCount} inserted=${inserted.map(({ id }) => id).join(',') || 'none'}`);
    if (discarded) {
      for (const message of removed) this.trace(`agent/inbox/discarded ${message.id}`);
    }
    for (const message of event.data.inserted) this.trace(`agent/inbox/inserted ${message.id}`);
    return removed;
  }
}
