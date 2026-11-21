type PlaybackStatus = 'playing' | 'paused' | 'finished';
class AnimationState {
    elapsed = 0;
    completedLoops = 0;
    status: PlaybackStatus = 'playing';
    constructor(readonly duration: number, readonly loopCount: number) {
        if (duration <= 0 || loopCount < 1) throw new Error('duration and loopCount must be positive');
    }
    get localTime(): number { return this.status === 'finished' ? this.duration : this.elapsed % this.duration; }
    play(): void { if (this.status === 'paused') this.status = 'playing'; }
    pause(): void { if (this.status === 'playing') this.status = 'paused'; }
    update(dt: number): void {
        if (this.status !== 'playing' || dt <= 0) return;
        this.elapsed = Math.min(this.elapsed + dt, this.duration * this.loopCount);
        this.completedLoops = Math.min(this.loopCount, Math.floor(this.elapsed / this.duration));
        if (this.elapsed >= this.duration * this.loopCount) this.status = 'finished';
    }
}
class AnimationManager {
    private readonly states = new Set<AnimationState>();
    add(state: AnimationState): void { this.states.add(state); }
    update(dt: number): void { for (const state of this.states) state.update(dt); }
}
export function runLesson(): string[] {
    const manager = new AnimationManager();
    const state = new AnimationState(0.3, 2);
    manager.add(state);
    manager.update(0.2);
    const firstTime = state.localTime;
    manager.update(0.5);
    return [
        `after first step: localTime=${firstTime.toFixed(2)}s, loops=${state.completedLoops}`,
        `after second step: elapsed=${state.elapsed.toFixed(2)}s, loops=${state.completedLoops}`,
        `status = ${state.status}`,
    ];
}
