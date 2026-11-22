type StateKind = "base" | "additive";
class AnimationState {
  time = 0;
  constructor(readonly name: string, readonly kind: StateKind, readonly sample: number, public weight = 1) {}
  update(dt: number): void { this.time += dt; }
  sampleValue(): number { return this.sample; }
}
type Transition = { from: AnimationState; to: AnimationState; duration: number; elapsed: number };
class CCAnimation {
  private current: AnimationState | null = null;
  private transition: Transition | null = null;
  private readonly additive = new Set<AnimationState>();
  play(name: string, sample: number): AnimationState {
    const next = new AnimationState(name, "base", sample);
    this.current = next; this.transition = null;
    return next;
  }
  crossFade(name: string, sample: number, duration: number): AnimationState {
    if (duration <= 0 || !this.current) return this.play(name, sample);
    const next = new AnimationState(name, "base", sample, 0);
    this.transition = { from: this.current, to: next, duration, elapsed: 0 };
    this.current = next;
    return next;
  }
  playAdditive(name: string, sample: number, weight: number): AnimationState {
    const state = new AnimationState(name, "additive", sample, Math.max(0, Math.min(1, weight)));
    this.additive.add(state); return state;
  }
  stopAdditive(name: string): void { for (const state of this.additive) if (state.name === name) this.additive.delete(state); }
  update(dt: number): void {
    if (this.transition) {
      const transition = this.transition;
      transition.elapsed = Math.min(transition.duration, transition.elapsed + dt);
      const ratio = transition.elapsed / transition.duration;
      transition.from.weight = 1 - ratio; transition.to.weight = ratio;
      transition.from.update(dt); transition.to.update(dt);
      if (ratio >= 1) this.transition = null;
    } else this.current?.update(dt);
    for (const state of this.additive) state.update(dt);
  }
  get blendedValue(): number {
    const base = this.transition
      ? this.transition.from.sampleValue() * this.transition.from.weight + this.transition.to.sampleValue() * this.transition.to.weight
      : this.current?.sampleValue() ?? 0;
    return base + [...this.additive].reduce((sum, state) => sum + state.sampleValue() * state.weight, 0);
  }
  get activeStates(): AnimationState[] { return [...(this.transition ? [this.transition.from, this.transition.to] : this.current ? [this.current] : []), ...this.additive]; }
}
export function runLesson(): string[] {
  const animation = new CCAnimation();
  animation.play("idle", 0); animation.crossFade("run", 10, 0.4); animation.playAdditive("breath", 2, 0.25);
  const log: string[] = [];
  for (const dt of [0.1, 0.1, 0.2]) {
    animation.update(dt);
    log.push(`dt=${dt.toFixed(1)} -> ${animation.activeStates.map((state) => `${state.kind}:${state.name}[w=${state.weight.toFixed(2)}]`).join(" + ")}; output=${animation.blendedValue.toFixed(2)}`);
  }
  animation.stopAdditive("breath");
  log.push(`after removing additive track -> output=${animation.blendedValue.toFixed(2)}`);
  log.push("source boundary: Creator 2.4 Animation and AnimationState use clip/wrap/playback and cross-fade state; this model isolates scalar blending, not full curve binding or state-machine semantics");
  return log;
}
