type Vec3 = [number, number, number];

class PhysicsMaterial {
    constructor(readonly friction: number, readonly restitution: number) {
        if (friction < 0 || restitution < 0 || restitution > 1) throw new Error('invalid physics material');
    }
}

class CannonBoxShape {
    constructor(readonly halfExtents: Vec3) {}
}

class BoxColliderComponent {
    shape: CannonBoxShape | null = null;
    constructor(
        readonly size: Vec3,
        readonly nodeScale: Vec3,
        readonly material: PhysicsMaterial,
    ) {}
    createShape(): CannonBoxShape {
        const extents = this.size.map((size, i) => Math.abs(size * this.nodeScale[i]) * 0.5) as Vec3;
        this.shape = new CannonBoxShape(extents);
        return this.shape;
    }
    createBackendFixture(): { shape: CannonBoxShape; friction: number; restitution: number } {
        const shape = this.shape ?? this.createShape();
        return { shape, friction: this.material.friction, restitution: this.material.restitution };
    }
}

export function runLesson(): string[] {
    const box = new BoxColliderComponent([2, 1, 1], [2, 1, 0.5], new PhysicsMaterial(0.4, 0.1));
    const fixture = box.createBackendFixture();
    return [
        'backend shape = box',
        `scaled halfExtents = ${fixture.shape.halfExtents.join(', ')}`,
        `fixture material: friction=${fixture.friction}, restitution=${fixture.restitution}`,
    ];
}
