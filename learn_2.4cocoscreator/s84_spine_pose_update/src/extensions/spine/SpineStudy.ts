type BoneTransform = { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
type Matrix2D = { a: number; b: number; c: number; d: number; tx: number; ty: number };
class Bone {
  readonly world: Matrix2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  constructor(readonly name: string, public local: BoneTransform, readonly parent: Bone | null = null) {}
  updateWorldTransform(): void {
    const rad = this.local.rotation * Math.PI / 180;
    const la = Math.cos(rad) * this.local.scaleX, lb = Math.sin(rad) * this.local.scaleX;
    const lc = -Math.sin(rad) * this.local.scaleY, ld = Math.cos(rad) * this.local.scaleY;
    if (!this.parent) Object.assign(this.world, { a: la, b: lb, c: lc, d: ld, tx: this.local.x, ty: this.local.y });
    else {
      const p = this.parent.world;
      Object.assign(this.world, {
        a: p.a * la + p.c * lb, b: p.b * la + p.d * lb,
        c: p.a * lc + p.c * ld, d: p.b * lc + p.d * ld,
        tx: p.a * this.local.x + p.c * this.local.y + p.tx,
        ty: p.b * this.local.x + p.d * this.local.y + p.ty,
      });
    }
  }
  get worldRotation(): number { return Math.atan2(this.world.b, this.world.a) * 180 / Math.PI; }
}
class OneBoneAimConstraint {
  constructor(readonly bone: Bone, readonly target: { x: number; y: number }, readonly mix: number) {}
  apply(): void {
    const dx = this.target.x - this.bone.world.tx, dy = this.target.y - this.bone.world.ty;
    const wanted = Math.atan2(dy, dx) * 180 / Math.PI;
    const delta = ((wanted - this.bone.worldRotation + 540) % 360) - 180;
    // The real Spine runtime constraints are richer; this demonstrates constraint ordering.
    const angle = (this.bone.worldRotation + delta * this.mix) * Math.PI / 180;
    const sx = Math.hypot(this.bone.world.a, this.bone.world.b), sy = Math.hypot(this.bone.world.c, this.bone.world.d);
    this.bone.world.a = Math.cos(angle) * sx; this.bone.world.b = Math.sin(angle) * sx;
    this.bone.world.c = -Math.sin(angle) * sy; this.bone.world.d = Math.cos(angle) * sy;
  }
}
class Skeleton {
  private readonly byName: Map<string, Bone>;
  constructor(readonly bones: readonly Bone[], readonly constraints: readonly OneBoneAimConstraint[]) {
    this.byName = new Map(bones.map((bone) => [bone.name, bone]));
    for (const bone of bones) if (bone.parent && !this.byName.has(bone.parent.name)) throw new Error(`parent ${bone.parent.name} must appear before child ${bone.name}`);
  }
  update(applyAnimation: () => void): void {
    applyAnimation(); // AnimationState applies local timelines before world matrices are rebuilt.
    for (const bone of this.bones) bone.updateWorldTransform();
    for (const constraint of this.constraints) constraint.apply();
  }
}
export function runLesson(): string[] {
  const root = new Bone("root", { x: 2, y: 1, rotation: 30, scaleX: 1.5, scaleY: 1 });
  const arm = new Bone("arm", { x: 3, y: 0, rotation: 15, scaleX: 1, scaleY: 1 }, root);
  const skeleton = new Skeleton([root, arm], [new OneBoneAimConstraint(arm, { x: 2, y: 8 }, 0.5)]);
  skeleton.update(() => { arm.local.x = 4; });
  return [
    "order = AnimationState.apply(local timelines) -> Bone.updateWorldTransform(parent first) -> constraints",
    `arm world matrix = [${[arm.world.a, arm.world.b, arm.world.c, arm.world.d].map((v) => v.toFixed(2)).join(", ")}; ${arm.world.tx.toFixed(2)}, ${arm.world.ty.toFixed(2)}]`,
    `arm constrained world rotation = ${arm.worldRotation.toFixed(1)}deg; root rotation=${root.worldRotation.toFixed(1)}deg`,
    "source boundary: 2.4 delegates actual pose/constraint math to bundled Spine 3.8 Skeleton.updateWorldTransform; this scalar aim constraint only illustrates local-to-world and post-pose ordering",
  ];
}
