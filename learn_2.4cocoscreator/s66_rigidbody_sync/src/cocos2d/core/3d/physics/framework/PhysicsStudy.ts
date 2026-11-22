type Vec3 = { x: number; y: number; z: number };
type BodyType = "static" | "dynamic" | "kinematic";
type Body = { id: number; type: BodyType; position: Vec3; velocity: Vec3; awake: boolean };
const clone = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });

/** The example follows CannonWorld's scene->physics / step / physics->scene order. */
class CannonWorld {
  private readonly bodies = new Map<number, Body>();
  private nextId = 1;
  addBody(type: BodyType, position: Vec3): Body {
    const body: Body = { id: this.nextId++, type, position: clone(position), velocity: { x: 0, y: 0, z: 0 }, awake: true };
    this.bodies.set(body.id, body);
    return body;
  }
  removeBody(body: Body): void { this.bodies.delete(body.id); }
  step(dt: number): void {
    for (const body of this.bodies.values()) {
      if (body.type !== "dynamic" || !body.awake) continue;
      body.velocity.y -= 9.8 * dt;
      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
      body.position.z += body.velocity.z * dt;
    }
  }
  get bodyCount(): number { return this.bodies.size; }
}

/** Mirrors component enable/disable: create a backend body once, register it, then remove it. */
class CannonRigidBody {
  private sharedBody: Body | null = null;
  private enabled = false;
  constructor(readonly type: BodyType, readonly node: { position: Vec3 }, private readonly world: CannonWorld) {}
  onEnable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.sharedBody = this.world.addBody(this.type, this.node.position);
  }
  /** Dynamic bodies receive simulation output; kinematic bodies push node transforms to physics. */
  syncSceneToPhysics(): void {
    if (this.sharedBody && this.type === "kinematic") this.sharedBody.position = clone(this.node.position);
  }
  syncPhysicsToScene(): void {
    if (this.sharedBody && this.type === "dynamic") this.node.position = clone(this.sharedBody.position);
  }
  onDisable(): void {
    if (!this.enabled) return;
    if (this.sharedBody) this.world.removeBody(this.sharedBody);
    this.sharedBody = null;
    this.enabled = false;
  }
  get registered(): boolean { return this.sharedBody !== null; }
}

export function runLesson(): string[] {
  const log: string[] = [];
  const world = new CannonWorld();
  const node = { position: { x: 0, y: 2, z: 0 } };
  const body = new CannonRigidBody("dynamic", node, world);
  body.onEnable(); body.onEnable(); // repeated activation must not duplicate the backend body
  log.push(`onEnable -> shared body registered once; world bodies=${world.bodyCount}`);
  world.step(1 / 60); body.syncPhysicsToScene();
  log.push(`CannonWorld.step -> syncPhysicsToScene; node.position.y=${node.position.y.toFixed(3)}`);
  body.onDisable(); body.onDisable();
  log.push(`onDisable -> body removed idempotently; world bodies=${world.bodyCount}`);
  log.push("source boundary: CannonWorld.step orders syncSceneToPhysics -> backend step -> syncPhysicsToScene -> emitEvents");
  return log;
}
