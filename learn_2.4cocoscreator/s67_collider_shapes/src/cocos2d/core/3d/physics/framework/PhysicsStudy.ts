type Vec3 = [number, number, number];
type ShapeKind = "box" | "sphere" | "capsule";
class PhysicsMaterial {
  constructor(readonly friction: number, readonly restitution: number) {
    if (friction < 0 || friction > 1 || restitution < 0 || restitution > 1) throw new Error("material values must be in [0, 1]");
  }
}
interface BackendShape { readonly kind: ShapeKind; readonly dimensions: Vec3; }
class CannonShape implements BackendShape {
  constructor(readonly kind: ShapeKind, readonly dimensions: Vec3, public material: PhysicsMaterial | null, public trigger: boolean) {}
  setScale(scale: Vec3): void {
    this.dimensions[0] *= Math.abs(scale[0]);
    this.dimensions[1] *= Math.abs(scale[1]);
    this.dimensions[2] *= Math.abs(scale[2]);
  }
}
class Collider3D {
  private backend: CannonShape | null = null;
  private enabled = false;
  constructor(readonly name: string, readonly kind: ShapeKind, readonly size: Vec3, readonly center: Vec3,
    readonly nodeScale: Vec3, readonly material: PhysicsMaterial, readonly isTrigger = false) {}
  /** In Creator the selector creates the backend-specific shape before it joins SharedBody. */
  createBackendShape(): CannonShape {
    const dimensions: Vec3 = this.kind === "box"
      ? this.size.map((v) => Math.abs(v) * 0.5) as Vec3
      : this.kind === "sphere"
        ? [this.size[0] * 0.5, 0, 0]
        : [this.size[0] * 0.5, Math.max(0, this.size[1] * 0.5 - this.size[0] * 0.5), 0];
    const shape = new CannonShape(this.kind, dimensions, this.material, this.isTrigger);
    shape.setScale(this.nodeScale);
    this.backend = shape;
    return shape;
  }
  onEnable(): void { if (!this.backend) this.createBackendShape(); this.enabled = true; }
  onDisable(): void { this.enabled = false; }
  setSize(size: Vec3): void {
    this.size.splice(0, 3, ...size);
    // Shape dimensions must be rebuilt because backend geometry is derived from size and world scale.
    if (this.enabled) this.createBackendShape();
  }
  get shape(): CannonShape { return this.backend ?? this.createBackendShape(); }
}
class PhysicsBackendFixture {
  constructor(readonly shape: CannonShape, readonly friction: number, readonly restitution: number,
    readonly collisionResponse: boolean, readonly scaledCenter: Vec3) {}
}
function createFixture(collider: Collider3D): PhysicsBackendFixture {
  const shape = collider.shape;
  const scaledCenter = collider.center.map((v, i) => v * collider.nodeScale[i]) as Vec3;
  return new PhysicsBackendFixture(shape, collider.material.friction, collider.material.restitution,
    !collider.isTrigger, scaledCenter);
}

export function runLesson(): string[] {
  const material = new PhysicsMaterial(0.4, 0.15);
  const box = new Collider3D("CrateCollider", "box", [2, 1, 1], [0, 0.5, 0], [2, 1, 0.5], material);
  box.onEnable();
  const first = createFixture(box);
  box.setSize([4, 1, 1]);
  const resized = createFixture(box);
  const sensor = new Collider3D("Sensor", "sphere", [2, 0, 0], [0, 0, 0], [1, 2, 1], material, true);
  sensor.onEnable();
  const sensorFixture = createFixture(sensor);
  return [
    `box half extents (size / 2 * abs world scale) = ${first.shape.dimensions.join(",")}`,
    `center is separately scaled into shared-body local offset = ${first.scaledCenter.join(",")}`,
    `size mutation rebuilds backend shape: ${first.shape !== resized.shape}; new half extents=${resized.shape.dimensions.join(",")}`,
    `material copied to backend: friction=${resized.friction}, restitution=${resized.restitution}`,
    `trigger=${sensorFixture.shape.trigger}; Cannon collisionResponse=${sensorFixture.collisionResponse}`,
    "scope: box/sphere/capsule dimensions are teaching conversions; real backends have their own shape setters and center transforms",
  ];
}
