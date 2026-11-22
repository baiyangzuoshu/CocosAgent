type TrackEvent = { name: string; time: number; intValue?: number; floatValue?: number; stringValue?: string };
type ListenerSet = { event?: (entry: TrackEntry, event: TrackEvent) => void; complete?: (entry: TrackEntry, loopCount: number) => void; dispose?: (entry: TrackEntry) => void };
class TrackEntry {
  readonly listeners: ListenerSet = {};
  constructor(readonly id: number, readonly animation: string, readonly duration: number, readonly loop: boolean) {}
  clearListeners(): void { this.listeners.event = undefined; this.listeners.complete = undefined; this.listeners.dispose = undefined; }
}
class SpineEventQueue {
  private readonly queued: Array<() => void> = [];
  queueEvent(entry: TrackEntry, event: TrackEvent): void { this.queued.push(() => entry.listeners.event?.(entry, event)); }
  queueComplete(entry: TrackEntry, loopCount: number): void { this.queued.push(() => entry.listeners.complete?.(entry, loopCount)); }
  queueDispose(entry: TrackEntry): void { this.queued.push(() => { entry.listeners.dispose?.(entry); entry.clearListeners(); }); }
  drain(): void { for (const event of this.queued.splice(0)) event(); }
  clear(): void { this.queued.length = 0; }
}
class SkeletonCache {
  private readonly references = new Map<string, number>();
  retain(uuid: string): void { this.references.set(uuid, (this.references.get(uuid) ?? 0) + 1); }
  release(uuid: string): number { const count = Math.max(0, (this.references.get(uuid) ?? 0) - 1); this.references.set(uuid, count); return count; }
  count(uuid: string): number { return this.references.get(uuid) ?? 0; }
}
class SpineComponent {
  private readonly entries = new Set<TrackEntry>();
  private readonly queue = new SpineEventQueue();
  private attached = false;
  constructor(readonly dataUuid: string, private readonly cache: SkeletonCache) {}
  onEnable(): void { if (!this.attached) { this.cache.retain(this.dataUuid); this.attached = true; } }
  addEntry(entry: TrackEntry): void { this.entries.add(entry); }
  dispatch(event: TrackEvent): void { for (const entry of this.entries) this.queue.queueEvent(entry, event); }
  complete(entry: TrackEntry, loopCount = 1): void { if (this.entries.has(entry)) this.queue.queueComplete(entry, loopCount); }
  lateUpdate(): void { this.queue.drain(); } // Runtime queues notifications and dispatches after state update.
  disposeEntry(entry: TrackEntry): void { if (this.entries.delete(entry)) this.queue.queueDispose(entry); }
  onDisable(): void { /* component may re-enable; do not destroy shared skeleton data here */ }
  onDestroy(): void {
    if (!this.attached) return;
    this.queue.clear();
    for (const entry of this.entries) entry.clearListeners();
    this.entries.clear();
    this.cache.release(this.dataUuid);
    this.attached = false;
  }
}
export function runLesson(): string[] {
  const log: string[] = [], cache = new SkeletonCache();
  const component = new SpineComponent("hero-skeleton-data", cache); component.onEnable();
  const entry = new TrackEntry(1, "run", 0.8, true);
  entry.listeners.event = (track, event) => log.push(`${track.animation} event ${event.name} @ ${event.time}s payload=${event.stringValue ?? ""}`);
  entry.listeners.complete = (_track, count) => log.push(`loop complete x${count}`);
  entry.listeners.dispose = (track) => log.push(`TrackEntry#${track.id} disposed`);
  component.addEntry(entry);
  component.dispatch({ name: "footstep", time: 0.3, stringValue: "left" }); component.complete(entry, 1);
  log.push(`notifications queued; cache refs=${cache.count("hero-skeleton-data")}`);
  component.lateUpdate(); component.disposeEntry(entry); component.lateUpdate();
  component.onDestroy(); log.push(`destroy: listeners detached; cache refs=${cache.count("hero-skeleton-data")}`);
  log.push("source boundary: Skeleton.js maps Spine AnimationState listeners to component events; SkeletonCache modes own cached pose data differently, so this reference counter only illustrates component lifetime");
  return log;
}
