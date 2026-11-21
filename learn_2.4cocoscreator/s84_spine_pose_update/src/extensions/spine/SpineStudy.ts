type BoneTransform = { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
class Bone {
    readonly world = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    constructor(readonly name: string, readonly local: BoneTransform, readonly parent: Bone | null = null) {}
    updateWorldTransform(): void {
        const radians = (this.parent?.world.rotation ?? 0) * Math.PI / 180;
        const parentX = this.parent?.world.x ?? 0;
        const parentY = this.parent?.world.y ?? 0;
        const scaleX = this.parent?.world.scaleX ?? 1;
        const scaleY = this.parent?.world.scaleY ?? 1;
        this.world.x = parentX + Math.cos(radians) * this.local.x * scaleX - Math.sin(radians) * this.local.y * scaleY;
        this.world.y = parentY + Math.sin(radians) * this.local.x * scaleX + Math.cos(radians) * this.local.y * scaleY;
        this.world.rotation = (this.parent?.world.rotation ?? 0) + this.local.rotation;
        this.world.scaleX = scaleX * this.local.scaleX;
        this.world.scaleY = scaleY * this.local.scaleY;
    }
}
class RotationConstraint {
    constructor(readonly bone: Bone, readonly targetRotation: number, readonly mix: number) {}
    apply(): void {
        this.bone.world.rotation += (this.targetRotation - this.bone.world.rotation) * this.mix;
    }
}
class Skeleton {
    constructor(readonly bones: readonly Bone[], readonly constraints: readonly RotationConstraint[]) {}
    update(applyAnimation: () => void): void {
        applyAnimation();
        for (const bone of this.bones) bone.updateWorldTransform();
        for (const constraint of this.constraints) constraint.apply();
    }
}
export function runLesson(): string[] {
    const root = new Bone('root', { x: 2, y: 1, rotation: 0, scaleX: 1, scaleY: 1 });
    const arm = new Bone('arm', { x: 3, y: 0, rotation: 15, scaleX: 1, scaleY: 1 }, root);
    const skeleton = new Skeleton([root, arm], [new RotationConstraint(arm, 45, 0.5)]);
    skeleton.update(() => { arm.local.x = 4; });
    return [
        'order = AnimationState.update -> apply -> Bone.updateWorldTransform',
        `arm world position = (${arm.world.x.toFixed(2)}, ${arm.world.y.toFixed(2)})`,
        `arm world rotation after constraint = ${arm.world.rotation}deg`,
    ];
}
