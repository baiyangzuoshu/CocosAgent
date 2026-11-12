export function runLesson (): string[] {
    const capabilities = { rigidBody: true, collider: true, raycast: true, constraintComponent: false };
    return [
        `Physics3DManager backend = Builtin or Cannon`,
        `engine constraint component = ${capabilities.constraintComponent}`,
        `lesson boundary = use source-supported rigid body and collider APIs`,
    ];
}
