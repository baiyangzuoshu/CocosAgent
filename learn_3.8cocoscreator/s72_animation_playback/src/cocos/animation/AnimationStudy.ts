export function runLesson (): string[] {
    class AnimationState {
        time = 0; playing = true; finished = false;
        constructor (readonly duration: number, readonly loops: number) {}
        step (dt: number): void { if (!this.playing || this.finished) return; this.time += dt; if (this.time >= this.duration * this.loops) { this.time = this.duration * this.loops; this.finished = true; this.playing = false; } }
        get frame (): number { return Math.min(2, Math.floor((this.time / this.duration) * 3)); }
    }
    const state = new AnimationState(0.3, 2);
    state.step(0.2); const first = state.frame;
    state.step(0.5);
    return [`state time = ${state.time.toFixed(2)}s`, `sample step = ${first}`, `finished = ${state.finished}`];
}
