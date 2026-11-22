type WrapMode = "normal" | "loop" | "ping-pong";
type StateStatus = "stopped" | "playing" | "paused" | "finished";
class AnimationState {
  elapsed = 0;
  completedLoops = 0;
  status: StateStatus = "stopped";
  direction: 1 | -1 = 1;
  constructor(readonly duration: number, readonly wrapMode: WrapMode, readonly repeatCount = 1, public speed = 1) {
    if (duration <= 0 || repeatCount < 1 || speed === 0) throw new Error("invalid playback parameters");
  }
  get localTime(): number {
    if (this.status === "finished") return this.duration;
    const raw = this.elapsed % this.duration;
    return this.wrapMode === "ping-pong" && this.completedLoops % 2 === 1 ? this.duration - raw : raw;
  }
  play(): void { if (this.status === "stopped" || this.status === "finished") { this.elapsed = 0; this.completedLoops = 0; } this.status = "playing"; }
  pause(): void { if (this.status === "playing") this.status = "paused"; }
  resume(): void { if (this.status === "paused") this.status = "playing"; }
  stop(): void { this.status = "stopped"; this.elapsed = 0; this.completedLoops = 0; }
  update(dt: number): number {
    if (this.status !== "playing" || dt <= 0) return 0;
    const previousLoops = this.completedLoops;
    const totalDuration = this.duration * this.repeatCount;
    this.elapsed = Math.min(totalDuration, this.elapsed + dt * Math.abs(this.speed));
    this.completedLoops = Math.min(this.repeatCount, Math.floor(this.elapsed / this.duration));
    if (this.elapsed >= totalDuration) this.status = "finished";
    return this.completedLoops - previousLoops;
  }
}
class AnimationManager {
  private readonly states = new Set<AnimationState>();
  add(state: AnimationState): void { this.states.add(state); }
  remove(state: AnimationState): void { this.states.delete(state); }
  update(dt: number): string[] {
    const completed: string[] = [];
    for (const state of this.states) {
      const loops = state.update(dt);
      if (loops > 0) completed.push(`${loops} ${loops === 1 ? "loop boundary" : "loop boundaries"}`);
    }
    return completed;
  }
  get activeCount(): number { return this.states.size; }
}
export function runLesson(): string[] {
  const manager = new AnimationManager();
  const state = new AnimationState(0.3, "loop", 2);
  manager.add(state); state.play();
  manager.update(0.2); const first = `time=${state.localTime.toFixed(2)}; loops=${state.completedLoops}`;
  state.pause(); manager.update(0.5); const paused = `paused time=${state.localTime.toFixed(2)}; status=${state.status}`;
  state.resume(); const boundaries = manager.update(0.5);
  return [first, paused, `resume + 0.5s -> elapsed=${state.elapsed.toFixed(2)}, loops=${state.completedLoops}, status=${state.status}`,
    `crossed boundaries=${boundaries.join(", ") || "none"}; manager states=${manager.activeCount}`,
    "source boundary: 2.4 AnimationState carries wrapMode/time/repeatCount and AnimationManager updates registered Animation components; this model omits frame-rate sampling and reverse-wrap edge semantics"];
}
