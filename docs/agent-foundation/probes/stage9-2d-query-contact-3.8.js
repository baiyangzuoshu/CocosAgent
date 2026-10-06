// Paste into the Creator 3.8.7 Web preview DevTools console.
// Creates temporary nodes only; reload the preview after collecting the trace.
(async () => {
    let engine;
    try {
        engine = await System.import('cc');
    } catch (error) {
        console.error('STAGE9_2D_38_ERROR', 'Could not import preview cc module', error);
        return;
    }
    const { Node, BoxCollider2D, PhysicsSystem2D, Vec2, Size, Rect } = engine;
    const scene = engine.director.getScene();
    if (!scene || !Node || !BoxCollider2D || !PhysicsSystem2D) {
        console.error('STAGE9_2D_38_ERROR', 'Scene or 2D physics module unavailable');
        return;
    }
    if (PhysicsSystem2D.PHYSICS_NONE) {
        console.error('STAGE9_2D_38_ERROR', 'No active 2D physics backend');
        return;
    }
    const system = PhysicsSystem2D.instance;
    const world = system.physicsWorld;
    if (!world || typeof world.step !== 'function') {
        console.error('STAGE9_2D_38_ERROR', 'Active 2D physics backend unavailable');
        return;
    }

    const previousPaused = engine.game.isPaused();
    const nodes = [];
    const events = [];
    const trace = {
        backend: {
            builtin: PhysicsSystem2D.PHYSICS_BUILTIN,
            box2d: PhysicsSystem2D.PHYSICS_BOX2D,
            box2dWasm: PhysicsSystem2D.PHYSICS_BOX2D_WASM,
            worldClass: world.constructor.name,
        },
        system: { enable: system.enable, autoSimulation: system.autoSimulation },
        method: 'Web preview, temporary nodes; current world.step called manually',
    };
    try {
        const makeBox = (name, enabled) => {
            const node = new Node(name);
            node.active = false;
            scene.addChild(node);
            node.setPosition(20000, 20000, 0);
            const collider = node.addComponent(BoxCollider2D);
            collider.size = new Size(100, 100);
            collider.enabled = enabled;
            nodes.push(node);
            node.active = true;
            return collider;
        };
        const a = makeBox('stage9-query-a', true);
        const b = makeBox('stage9-query-b', false);
        for (const kind of ['begin-contact', 'end-contact', 'pre-solve', 'post-solve']) {
            a.on(kind, (...args) => events.push({ kind, argCount: args.length,
                self: args[0] === a ? 'a' : 'other', other: args[1] === b ? 'b' : 'other',
                contact: args.length > 2 ? typeof args[2] : 'omitted' }));
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (!previousPaused) engine.game.pause();
        b.enabled = true;
        world.syncSceneToPhysics();
        world.step(0.05, 10, 10);
        world.step(0.05, 10, 10);
        const first = system.testPoint(new Vec2(20000, 20000));
        const labels = (value) => Array.isArray(value)
            ? value.map((c) => c === a ? 'a' : c === b ? 'b' : 'other')
            : String(value);
        const before = labels(first);
        const aabb = system.testAABB(new Rect(19950, 19950, 100, 100));
        const aabbLabels = labels(aabb);
        const afterAabb = labels(first);
        system.testPoint(new Vec2(20000000, 20000000));
        trace.queries = {
            testPointIsArray: Array.isArray(first),
            testPointBeforeNextQuery: before,
            testAABB: aabbLabels,
            firstArrayAfterAABB: afterAabb,
            firstArrayAfterFarQuery: labels(first),
            builtinRaycastCount: PhysicsSystem2D.PHYSICS_BUILTIN
                ? system.raycast(new Vec2(19900, 20000), new Vec2(20100, 20000)).length
                : 'not-builtin',
        };
        b.enabled = false;
        trace.contacts = events;
        console.log('STAGE9_2D_38', JSON.stringify(trace));
    } catch (error) {
        console.error('STAGE9_2D_38_ERROR', error, JSON.stringify(trace));
    } finally {
        for (const node of nodes) { node.removeFromParent(); node.destroy(); }
        if (!previousPaused) engine.game.resume();
    }
})();
