type TrackEntry = { id: number; animation: string; loop: boolean; duration: number; time: number; mixTime: number; mixDuration: number; next: TrackEntry | null; delay: number; completed: boolean };
type EntryListener = (entry: TrackEntry, type: "start" | "complete" | "interrupt" | "end" | "dispose") => void;
class AnimationStateData {
  private readonly mixDurations = new Map<string, number>();
  setMix(from: string, to: string, duration: number): void { this.mixDurations.set(`${from}->${to}`, Math.max(0, duration)); }
  getMix(from: string, to: string): number { return this.mixDurations.get(`${from}->${to}`) ?? 0; }
}
class AnimationState {
  private readonly tracks = new Map<number, TrackEntry>();
  private readonly listeners = new Set<EntryListener>();
  private nextId = 1;
  constructor(readonly data: AnimationStateData) {}
  on(listener: EntryListener): void { this.listeners.add(listener); }
  private dispatch(entry: TrackEntry, type: Parameters<EntryListener>[1]): void { for (const listener of this.listeners) listener(entry, type); }
  setAnimation(track: number, animation: string, duration: number, loop = false): TrackEntry {
    const previous = this.tracks.get(track);
    if (previous) { this.dispatch(previous, "interrupt"); this.dispatch(previous, "end"); this.dispatch(previous, "dispose"); }
    const entry = this.create(animation, duration, loop);
    if (previous) entry.mixDuration = this.data.getMix(previous.animation, animation);
    this.tracks.set(track, entry); this.dispatch(entry, "start"); return entry;
  }
  addAnimation(track: number, animation: string, duration: number, loop = false, delay = 0): TrackEntry {
    const entry = this.create(animation, duration, loop); entry.delay = delay;
    const current = this.tracks.get(track);
    if (!current) { this.tracks.set(track, entry); this.dispatch(entry, "start"); }
    else { let tail = current; while (tail.next) tail = tail.next; tail.next = entry; }
    return entry;
  }
  private create(animation: string, duration: number, loop: boolean): TrackEntry {
    if (duration <= 0) throw new Error("animation duration must be positive");
    return { id: this.nextId++, animation, duration, loop, time: 0, mixTime: 0, mixDuration: 0, next: null, delay: 0, completed: false };
  }
  update(dt: number): void {
    for (const [trackIndex, current] of this.tracks) {
      const oldTime = current.time;
      current.time += dt;
      current.mixTime = Math.min(current.mixDuration, current.mixTime + dt);
      if (current.loop) {
        const oldLoops = Math.floor(oldTime / current.duration), newLoops = Math.floor(current.time / current.duration);
        for (let loop = oldLoops; loop < newLoops; loop++) this.dispatch(current, "complete");
        current.time %= current.duration;
        continue;
      }
      if (current.time < current.duration) continue;
      if (!current.completed) { this.dispatch(current, "complete"); current.completed = true; }
      if (current.next && current.time >= current.duration + current.next.delay) {
        const next = current.next; next.time = current.time - current.duration - next.delay;
        next.mixDuration = this.data.getMix(current.animation, next.animation);
        this.dispatch(current, "end"); this.dispatch(current, "dispose");
        this.tracks.set(trackIndex, next); this.dispatch(next, "start");
      } else current.time = current.duration;
    }
  }
  snapshot(): string[] { return [...this.tracks].map(([track, entry]) => `track ${track}: ${entry.animation} t=${entry.time.toFixed(2)}/${entry.duration}s mix=${entry.mixTime.toFixed(2)}/${entry.mixDuration}s queued=${entry.next?.animation ?? "none"}`); }
}
export function runLesson(): string[] {
  const data = new AnimationStateData(); data.setMix("idle", "attack", 0.15); data.setMix("attack", "run", 0.1);
  const state = new AnimationState(data);
  const events: string[] = [];
  state.on((entry, type) => { if (["start", "complete", "interrupt", "dispose"].includes(type)) events.push(`TrackEntry#${entry.id} ${type}: ${entry.animation}`); });
  state.setAnimation(0, "idle", 0.4, false); state.addAnimation(0, "attack", 0.3, false); state.addAnimation(0, "run", 0.5, true);
  const log = state.snapshot(); state.update(0.45); log.push(...events.splice(0), ...state.snapshot()); state.update(0.35); log.push(...events.splice(0), ...state.snapshot());
  log.push("TrackEntry carries track time, loop, queue link and mix timing; AnimationState.update advances tracks and switches queued entries when their delay is reached");
  log.push("source boundary: actual Spine 3.8 AnimationState uses event queue notifications and detailed TrackEntry timelines/mix chains; scalar transition snapshot is intentionally smaller");
  return log;
}
