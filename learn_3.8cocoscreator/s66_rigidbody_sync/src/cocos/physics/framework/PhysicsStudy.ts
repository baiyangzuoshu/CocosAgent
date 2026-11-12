export function runLesson (): string[] {
    const log: string[] = [];
    const bodies = new Set<string>();
    const world = {
        addBody (name: string): void { bodies.add(name); log.push(`world.add(${name})`); },
        removeBody (name: string): void { bodies.delete(name); log.push(`world.remove(${name})`); },
        step (): number { log.push(`PhysicsSystem.step(1/60)`); return 4.25; },
    };
    class RigidBody {
        nodeY = 2;
        enabled = false;
        constructor (readonly name: string) {}
        onEnable (): void { this.enabled = true; world.addBody(this.name); }
        syncPhysicsToNode (bodyY: number): void { this.nodeY = bodyY; log.push(`node.y = ${bodyY}`); }
        onDisable (): void { this.enabled = false; world.removeBody(this.name); }
    }
    const body = new RigidBody('Crate');
    body.onEnable();
    body.syncPhysicsToNode(world.step());
    body.onDisable();
    log.push(`registered after disable = ${bodies.has(body.name)}`);
    return log;
}
