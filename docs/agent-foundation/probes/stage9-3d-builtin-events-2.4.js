// Run in a Cocos Creator 2.4.15 Web preview configured for the Builtin 3D backend.
// Compares collider-collider, trigger-collider, and trigger-trigger overlap pairs.
(async () => {
    const manager = cc.director.getPhysics3DManager();
    const worldName = manager && manager.physicsWorld && manager.physicsWorld.constructor.name;
    if (!manager || !cc.BoxCollider3D || worldName !== 'BuiltinWorld') {
        console.error('STAGE9_BUILTIN_3D_24_SKIP', JSON.stringify({ worldName, required: 'BuiltinWorld' }));
        return;
    }

    const previousEnabled = manager.enabled;
    const scene = cc.director.getScene();
    const cases = [
        { name: 'collider-collider', triggerA: false, triggerB: false },
        { name: 'trigger-collider', triggerA: true, triggerB: false },
        { name: 'trigger-trigger', triggerA: true, triggerB: true },
    ];
    const nodes = [];
    const counts = Object.create(null);
    try {
        manager.enabled = true;
        cases.forEach((entry, index) => {
            counts[entry.name] = { triggerA: 0, triggerB: 0, collisionA: 0, collisionB: 0 };
            const pair = [];
            ['A', 'B'].forEach((side) => {
                const node = new cc.Node(`stage9-${entry.name}-${side}`);
                node.setPosition(20000 + index * 20, 20000, 0);
                scene.addChild(node);
                nodes.push(node);
                const collider = node.addComponent(cc.BoxCollider3D);
                collider.size = new cc.Vec3(2, 2, 2);
                collider.isTrigger = side === 'A' ? entry.triggerA : entry.triggerB;
                collider.on('trigger-enter', () => { counts[entry.name][`trigger${side}`] += 1; });
                collider.on('collision-enter', () => { counts[entry.name][`collision${side}`] += 1; });
                pair.push(collider);
            });
            entry.colliderIds = pair.map((collider) => collider.node.name);
        });

        await new Promise((resolve) => setTimeout(resolve, 350));
        console.log('STAGE9_BUILTIN_3D_24', JSON.stringify({
            version: '2.4.15', backend: worldName, previousEnabled,
            enabledDuringProbe: manager.enabled,
            cases: cases.map(({ name, triggerA, triggerB, colliderIds }) => ({
                name, triggerA, triggerB, colliderIds, ...counts[name],
            })),
            note: 'Counts are enter callbacks sampled over 350 ms; this probe does not infer Cannon behavior.',
        }));
    } catch (error) {
        console.error('STAGE9_BUILTIN_3D_24_ERROR', error);
    } finally {
        nodes.forEach((node) => { node.removeFromParent(); node.destroy(); });
        manager.enabled = previousEnabled;
    }
})();
