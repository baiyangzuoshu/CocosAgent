type ClipEvent = { time: number; name: string };
type Listener = (event: ClipEvent) => void;
class AnimationState {
    private previousTime = 0;
    private readonly listeners = new Set<Listener>();
    constructor(readonly events: readonly ClipEvent[], readonly duration: number) {}
    onEvent(listener: Listener): void { this.listeners.add(listener); }
    update(currentTime: number): void {
        const bounded = Math.min(currentTime, this.duration);
        for (const event of this.events) {
            if (this.previousTime < event.time && event.time <= bounded) {
                for (const listener of this.listeners) listener(event);
            }
        }
        this.previousTime = bounded;
    }
    finish(onFinished: () => void): void { if (this.previousTime >= this.duration) onFinished(); }
}
export function runLesson(): string[] {
    const log: string[] = [];
    const state = new AnimationState([
        { time: 0.25, name: 'footstep' }, { time: 0.75, name: 'land' },
    ], 1);
    state.onEvent((event) => log.push(`event: ${event.name} @ ${event.time}s`));
    state.update(0.2);
    state.update(0.8);
    state.update(1);
    state.finish(() => log.push('finished callback'));
    return log;
}
