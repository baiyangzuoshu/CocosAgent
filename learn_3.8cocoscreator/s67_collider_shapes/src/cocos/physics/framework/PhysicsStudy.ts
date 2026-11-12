export function runLesson (): string[] {
    class PhysicsMaterial { constructor (readonly friction: number, readonly restitution: number) {} }
    class BoxCollider {
        constructor (readonly size: [number, number, number], readonly scale: [number, number, number], readonly material: PhysicsMaterial) {}
        get halfExtents (): [number, number, number] {
            return [0, 1, 2].map((i) => this.size[i] * this.scale[i] * 0.5) as [number, number, number];
        }
    }
    const box = new BoxCollider([2, 1, 1], [2, 1, 0.5], new PhysicsMaterial(0.4, 0.1));
    return [
        `shape = box`,
        `halfExtents = ${box.halfExtents.join(', ')}`,
        `material friction = ${box.material.friction}`,
    ];
}
