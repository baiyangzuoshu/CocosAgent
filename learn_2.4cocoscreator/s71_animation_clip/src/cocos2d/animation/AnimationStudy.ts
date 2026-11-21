type Key = { time: number; value: number };
class AnimationClip {
    constructor(readonly name: string, readonly duration: number, readonly keys: readonly Key[]) {}
}
class AnimationState {
    time = 0;
    constructor(readonly clip: AnimationClip, readonly targetPath: string) {}
}
class CCAnimation {
    private readonly clips = new Map<string, AnimationClip>();
    private readonly states = new Map<string, AnimationState>();
    addClip(clip: AnimationClip): void { this.clips.set(clip.name, clip); }
    createState(name: string, targetPath: string): AnimationState {
        const clip = this.clips.get(name);
        if (!clip) throw new Error(`unknown clip: ${name}`);
        const state = new AnimationState(clip, targetPath);
        this.states.set(name, state);
        return state;
    }
}
export function runLesson(): string[] {
    const clip = new AnimationClip('move', 1, [{ time: 0, value: 0 }, { time: 1, value: 10 }]);
    const animation = new CCAnimation();
    animation.addClip(clip);
    const state = animation.createState('move', 'Player.position.x');
    return [
        `CCAnimation registered clip = ${state.clip.name}`,
        `state target = ${state.targetPath}`,
        `duration = ${state.clip.duration}s; keyframes = ${state.clip.keys.length}`,
    ];
}
