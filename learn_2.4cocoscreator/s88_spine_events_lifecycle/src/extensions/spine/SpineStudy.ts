type TrackEvent = { name: string; time: number; payload?: string };
type Listener = (entry: string, event: TrackEvent) => void;
class TrackEntry {
    private eventListener: Listener | null = null;
    private completeListener: (() => void) | null = null;
    constructor(readonly name: string) {}
    onEvent(listener: Listener): void { this.eventListener = listener; }
    onComplete(listener: () => void): void { this.completeListener = listener; }
    dispatchEvent(event: TrackEvent): void { this.eventListener?.(this.name, event); }
    dispatchComplete(): void { this.completeListener?.(); }
    clearListeners(): void { this.eventListener = null; this.completeListener = null; }
}
class SpineComponent {
    private readonly entries: TrackEntry[] = [];
    private attached = true;
    constructor(private cacheRefCount: { value: number }) {}
    addEntry(entry: TrackEntry): void { this.entries.push(entry); }
    dispatch(event: TrackEvent): void { for (const entry of this.entries) entry.dispatchEvent(event); }
    complete(): void { for (const entry of this.entries) entry.dispatchComplete(); }
    onDestroy(): void {
        if (!this.attached) return;
        for (const entry of this.entries) entry.clearListeners();
        this.entries.length = 0;
        this.attached = false;
        this.cacheRefCount.value = Math.max(0, this.cacheRefCount.value - 1);
    }
}
export function runLesson(): string[] {
    const log: string[] = [];
    const cache = { value: 1 };
    const component = new SpineComponent(cache);
    const entry = new TrackEntry('run');
    entry.onEvent((name, event) => log.push(`${name} event ${event.name} @ ${event.time}s ${event.payload ?? ''}`));
    entry.onComplete(() => log.push('run complete'));
    component.addEntry(entry);
    component.dispatch({ name: 'footstep', time: 0.3, payload: 'left' });
    component.complete();
    component.onDestroy();
    log.push(`listeners detached; cache refs=${cache.value}`);
    return log;
}
