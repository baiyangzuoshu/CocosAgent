type Vec3 = { x: number; y: number; z: number };
type Body = { name: string; position: Vec3; velocity: Vec3 };

class PhysicsWorld {
    private readonly bodies = new Map<string, Body>();
    addBody(body: Body): void { this.bodies.set(body.name, body); }
    removeBody(name: string): void { this.bodies.delete(name); }
    step(dt: number): void {
        for (const body of this.bodies.values()) {
            body.velocity.y -= 9.8 * dt;
            body.position.x += body.velocity.x * dt;
            body.position.y += body.velocity.y * dt;
            body.position.z += body.velocity.z * dt;
        }
    }
}

class RigidBodyComponent {
    private body: Body | null = null;
    constructor(readonly name: string, private readonly world: PhysicsWorld, public nodePosition: Vec3) {}
    onEnable(): void {
        if (this.body) return;
        this.body = { name: this.name, position: { ...this.nodePosition }, velocity: { x: 0, y: 0, z: 0 } };
        this.world.addBody(this.body);
    }
    syncPhysicsToNode(): void {
        if (this.body) this.nodePosition = { ...this.body.position };
    }
    onDisable(): void {
        if (!this.body) return;
        this.world.removeBody(this.body.name);
        this.body = null;
    }
}

export function runLesson(): string[] {
    const log: string[] = [];
    const world = new PhysicsWorld();
    const body = new RigidBodyComponent('Crate', world, { x: 0, y: 2, z: 0 });
    body.onEnable();
    log.push('onEnable: body registered');
    world.step(1 / 60);
    body.syncPhysicsToNode();
    log.push(`after step: node.y=${body.nodePosition.y.toFixed(3)}`);
    body.onDisable();
    log.push('onDisable: body removed');
    return log;
}
