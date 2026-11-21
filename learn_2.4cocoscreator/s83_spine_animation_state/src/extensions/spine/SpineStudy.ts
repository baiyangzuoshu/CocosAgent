type TrackEntry = { animation: string; loop: boolean; duration: number; time: number };
class AnimationState {
    private readonly tracks = new Map<number, TrackEntry>();
    private readonly queues = new Map<number, TrackEntry[]>();
    private readonly mixDurations = new Map<string, number>();
    setMix(from: string, to: string, duration: number): void { this.mixDurations.set(`${from}->${to}`, duration); }
    setAnimation(track: number, animation: string, duration: number, loop = false): TrackEntry {
        const entry = { animation, duration, loop, time: 0 };
        this.tracks.set(track, entry);
        this.queues.set(track, []);
        return entry;
    }
    addAnimation(track: number, animation: string, duration: number, loop = false): TrackEntry {
        const entry = { animation, duration, loop, time: 0 };
        const queue = this.queues.get(track) ?? [];
        queue.push(entry);
        this.queues.set(track, queue);
        return entry;
    }
    update(dt: number): string[] {
        const transitions: string[] = [];
        for (const [track, current] of this.tracks) {
            current.time += dt;
            if (current.loop) current.time %= current.duration;
            else if (current.time >= current.duration) {
                const next = this.queues.get(track)?.shift();
                if (next) {
                    next.time = current.time - current.duration;
                    this.tracks.set(track, next);
                    const mix = this.mixDurations.get(`${current.animation}->${next.animation}`) ?? 0;
                    transitions.push(`${current.animation} -> ${next.animation}, mix=${mix}s`);
                } else current.time = current.duration;
            }
        }
        return transitions;
    }
    snapshot(): string[] {
        return [...this.tracks].map(([track, entry]) => `track ${track}: ${entry.animation} @ ${entry.time.toFixed(2)}s; queued=${this.queues.get(track)?.length ?? 0}`);
    }
}
export function runLesson(): string[] {
    const state = new AnimationState();
    state.setMix('idle', 'attack', 0.15);
    state.setAnimation(0, 'idle', 0.4, false);
    state.addAnimation(0, 'attack', 0.3, false);
    const before = state.snapshot();
    const transitions = state.update(0.45);
    return [...before, ...transitions, ...state.snapshot()];
}
