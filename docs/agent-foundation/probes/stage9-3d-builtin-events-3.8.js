// Run in a Cocos Creator 3.8.7 Web preview configured for the Builtin 3D backend.
// Compares collider-collider, trigger-collider, and trigger-trigger overlap pairs.
(async () => {
    let api;
    try { api = await System.import('cc'); }
    catch (error) { console.error('STAGE9_BUILTIN_3D_38_ERROR', 'cc import failed', error); return; }
    const { BoxCollider, Node, Vec3, PhysicsSystem, director } = api;
    const system = PhysicsSystem.instance;
    const worldName = system && system.physicsWorld && system.physicsWorld.constructor.name;
    if (!system || !BoxCollider || worldName !== 'BuiltinWorld') {
        console.error('STAGE9_BUILTIN_3D_38_SKIP', JSON.stringify({ worldName, required: 'BuiltinWorld' }));
        return;
    }

    const previousEnabled = system.enable;
    const scene = director.getScene();
    const cases = [
        { name: 'collider-collider', triggerA: false, triggerB: false },
        { name: 'trigger-collider', triggerA: true, triggerB: false },
        { name: 'trigger-trigger', triggerA: true, triggerB: true },
    ];
    const nodes = [];
    const counts = Object.create(null);
    try {
        system.enable = true;
        cases.forEach((entry, index) => {
            counts[entry.name] = { triggerA: 0, triggerB: 0, collisionA: 0, collisionB: 0 };
            const pair = [];
            ['A', 'B'].forEach((side) => {
                const node = new Node(`stage9-${entry.name}-${side}`);
                node.setPosition(20000 + index * 20, 20000, 0);
                scene.addChild(node);
                nodes.push(node);
                const collider = node.addComponent(BoxCollider);
                collider.size = new Vec3(2, 2, 2);
                collider.isTrigger = side === 'A' ? entry.triggerA : entry.triggerB;
                collider.on('onTriggerEnter', () => { counts[entry.name][`trigger${side}`] += 1; });
                collider.on('onCollisionEnter', () => { counts[entry.name][`collision${side}`] += 1; });
                pair.push(collider);
            });
            entry.colliderIds = pair.map((collider) => collider.node.name);
        });

        await new Promise((resolve) => setTimeout(resolve, 350));
        console.log('STAGE9_BUILTIN_3D_38', JSON.stringify({
            version: '3.8.7', backend: worldName, previousEnabled,
            enabledDuringProbe: system.enable,
            cases: cases.map(({ name, triggerA, triggerB, colliderIds }) => ({
                name, triggerA, triggerB, colliderIds, ...counts[name],
            })),
            note: 'Counts are enter callbacks sampled over 350 ms; this probe does not infer Bullet/PhysX/Cannon behavior.',
        }));
    } catch (error) {
        console.error('STAGE9_BUILTIN_3D_38_ERROR', error);
    } finally {
        nodes.forEach((node) => { node.removeFromParent(); node.destroy(); });
        system.enable = previousEnabled;
    }
})();
