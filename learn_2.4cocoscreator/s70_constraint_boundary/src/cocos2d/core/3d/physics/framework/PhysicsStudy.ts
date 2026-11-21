type Backend = 'Builtin' | 'Cannon';
type BackendCapabilities = { rigidBody: boolean; collider: boolean; raycast: boolean; constraintComponent: boolean };

class PhysicsSelector {
    select(backend: Backend): { backend: Backend; capabilities: BackendCapabilities } {
        // Creator 2.4.15 framework exposes these backend choices, but no engine-level 3D Constraint component.
        return {
            backend,
            capabilities: { rigidBody: true, collider: true, raycast: true, constraintComponent: false },
        };
    }
}

export function runLesson(): string[] {
    const selector = new PhysicsSelector();
    return (['Builtin', 'Cannon'] as const).flatMap((backend) => {
        const selected = selector.select(backend);
        return [
            `selected backend = ${selected.backend}`,
            `rigidBody/collider/raycast = ${selected.capabilities.rigidBody}/${selected.capabilities.collider}/${selected.capabilities.raycast}`,
            `engine constraint component = ${selected.capabilities.constraintComponent}`,
        ];
    });
}
