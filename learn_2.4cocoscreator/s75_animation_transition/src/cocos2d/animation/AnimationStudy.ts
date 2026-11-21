type StateKind = 'base' | 'additive';
class AnimationState {
    time = 0;
    constructor(readonly name: string, readonly kind: StateKind, readonly weight: number, readonly sample: number) {}
    update(dt: number): void { this.time += dt; }
}
class CCAnimation {
    private readonly states: AnimationState[] = [];
    play(name: string, sample: number): AnimationState {
        this.states.splice(0, this.states.length, new AnimationState(name, 'base', 1, sample));
        return this.states[0];
    }
    playAdditive(name: string, sample: number, weight: number): AnimationState {
        const state = new AnimationState(name, 'additive', Math.max(0, Math.min(1, weight)), sample);
        this.states.push(state);
        return state;
    }
    update(dt: number): void { for (const state of this.states) state.update(dt); }
    get activeStates(): readonly AnimationState[] { return this.states; }
    get blendedValue(): number {
        return this.states.reduce((value, state) => value + (state.kind === 'additive' ? state.sample * state.weight : state.sample), 0);
    }
}
export function runLesson(): string[] {
    const animation = new CCAnimation();
    animation.play('run', 10);
    animation.playAdditive('breath', 2, 0.5);
    animation.update(0.25);
    return [
        ...animation.activeStates.map((state) => `${state.kind}:${state.name} weight=${state.weight} sample=${state.sample} time=${state.time.toFixed(2)}s`),
        `base + weighted additive = ${animation.blendedValue}`,
    ];
}
