type Key = { time: number; value: number };
class AnimationCurve {
    constructor(readonly keys: readonly Key[]) {
        if (keys.length < 2 || keys.some((key, i) => i > 0 && key.time <= keys[i - 1].time)) {
            throw new Error('curve keys must have strictly increasing times');
        }
    }
    sample(time: number): number {
        if (time <= this.keys[0].time) return this.keys[0].value;
        const last = this.keys[this.keys.length - 1];
        if (time >= last.time) return last.value;
        for (let i = 0; i < this.keys.length - 1; i++) {
            const left = this.keys[i];
            const right = this.keys[i + 1];
            if (time <= right.time) {
                const t = (time - left.time) / (right.time - left.time);
                return left.value + (right.value - left.value) * t;
            }
        }
        return last.value;
    }
}
class NodeTarget {
    position = { x: 0 };
    constructor(readonly name: string) {}
}
class AnimationState {
    constructor(readonly curve: AnimationCurve, readonly target: NodeTarget) {}
    apply(time: number): void { this.target.position.x = this.curve.sample(time); }
}
export function runLesson(): string[] {
    const curve = new AnimationCurve([{ time: 0, value: 0 }, { time: 0.5, value: 10 }, { time: 1, value: 20 }]);
    const target = new NodeTarget('Player');
    const state = new AnimationState(curve, target);
    state.apply(0.75);
    return [`sample time = 0.75s`, `target = ${target.name}`, `position.x = ${target.position.x}`];
}
