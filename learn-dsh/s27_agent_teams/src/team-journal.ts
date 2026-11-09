import type { TeamTaskEvent, TeamTaskSnapshot } from "./types.ts";

/** Serializes task mutations and stores snapshots as root-session events. */
export class TeamJournal {
  #events: TeamTaskEvent[] = [];
  #nextTaskNumber = 1;
  #tail: Promise<void> = Promise.resolve();

  constructor(readonly rootSessionId: string) {}

  transact<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.#tail.then(operation);
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }

  nextTaskId(): string {
    return `task-${this.#nextTaskNumber++}`;
  }

  append(task: TeamTaskSnapshot): void {
    this.#events.push({
      type: "team/task",
      task: structuredClone(task),
    });
  }

  tasks(): TeamTaskSnapshot[] {
    const latest = new Map<string, TeamTaskSnapshot>();
    for (const event of this.#events) latest.set(event.task.id, event.task);
    return structuredClone([...latest.values()]);
  }

  snapshotEvents(): TeamTaskEvent[] {
    return structuredClone(this.#events);
  }
}
