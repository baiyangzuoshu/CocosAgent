export function runLesson (): string[] {
    class Physics3DConstraint {
        enabled = false;
        constructor (readonly bodyA: string, readonly bodyB: string, readonly type: string) {}
        onEnable (world: Set<Physics3DConstraint>): void { this.enabled = true; world.add(this); }
        onDisable (world: Set<Physics3DConstraint>): void { this.enabled = false; world.delete(this); }
    }
    const world = new Set<Physics3DConstraint>();
    const hinge = new Physics3DConstraint('Door', 'Frame', 'hinge');
    hinge.onEnable(world);
    const joined = world.has(hinge);
    hinge.onDisable(world);
    return [`PhysicsSystem.addConstraint hinge = ${joined}`, `removed after disable = ${!world.has(hinge)}`];
}
