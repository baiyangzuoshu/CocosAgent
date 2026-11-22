type ClipEvent = { time: number; func: string; params: unknown[] };
type Listener = (event: ClipEvent, loopIndex: number) => void;
class EventAnimCurve {
  private readonly listeners = new Set<Listener>();
  constructor(readonly events: readonly ClipEvent[], readonly duration: number) {
    if (duration <= 0 || events.some((event) => event.time < 0 || event.time > duration)) throw new Error("event time outside clip");
  }
  on(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  dispatch(from: number, to: number, loopIndex: number): void {
    for (const event of this.events) {
      if (from < event.time && event.time <= to) for (const listener of this.listeners) listener(event, loopIndex);
    }
  }
}
class AnimationState {
  elapsed = 0;
  private finished = false;
  constructor(readonly eventCurve: EventAnimCurve, readonly loop: boolean) {}
  update(dt: number): { crossedLoops: number; finishedNow: boolean } {
    if (dt <= 0 || this.finished) return { crossedLoops: 0, finishedNow: false };
    const duration = this.eventCurve.duration;
    const previous = this.elapsed;
    const next = this.loop ? previous + dt : Math.min(duration, previous + dt);
    const firstLoop = Math.floor(previous / duration);
    const lastLoop = Math.floor(next / duration);
    for (let loopIndex = firstLoop; loopIndex <= lastLoop; loopIndex++) {
      const from = loopIndex === firstLoop ? previous % duration : 0;
      const to = loopIndex === lastLoop ? next % duration : duration;
      this.eventCurve.dispatch(from, to, loopIndex);
    }
    this.elapsed = next;
    const finishedNow = !this.loop && next >= duration;
    if (finishedNow) this.finished = true;
    return { crossedLoops: Math.max(0, lastLoop - firstLoop), finishedNow };
  }
}
class AnimationManager {
  private readonly pendingCallbacks: Array<() => void> = [];
  queueCallback(callback: () => void): void { this.pendingCallbacks.push(callback); }
  flushCallbacks(): void { for (const callback of this.pendingCallbacks.splice(0)) callback(); }
}
export function runLesson(): string[] {
  const log: string[] = [];
  const curve = new EventAnimCurve([{ time: 0.25, func: "footstep", params: ["left"] }, { time: 0.75, func: "land", params: [] }], 1);
  curve.on((event, loop) => log.push(`event curve invokes ${event.func}(${event.params.join(",")}) at loop ${loop}`));
  const state = new AnimationState(curve, true);
  const manager = new AnimationManager();
  const update = state.update(1.3);
  log.push(`one manager update crosses ${update.crossedLoops} loop boundary; elapsed=${state.elapsed.toFixed(2)}s`);
  const once = new AnimationState(curve, false);
  once.update(0.2);
  const ended = once.update(0.9);
  if (ended.finishedNow) manager.queueCallback(() => log.push("AnimationState completion callback queued"));
  manager.flushCallbacks();
  log.push("source boundary: 2.4 EventAnimCurve buckets callbacks by ratio; state sampling detects crossed event ratios, then invokes target component functions");
  return log;
}
