// Creator 3.8.7 Web preview with BulletWorld; run after the scene is ready.
// Temporary overlap pairs test trigger/collision events and Kinematic behavior.
(async () => {
    let api;
    try { api = await System.import('cc'); }
    catch (error) { console.error('STAGE9_3D_BULLET_38_ERROR', 'cc import failed', error); return; }
    const { BoxCollider, RigidBody, Node, Vec3, PhysicsSystem, Director, director, game } = api;
    const system = PhysicsSystem.instance;
    const scene = director.getScene();
    const backend = system && system.physicsWorld && system.physicsWorld.constructor.name;
    if (!scene || !system || backend !== 'BulletWorld' || !BoxCollider || !RigidBody) {
        console.error('STAGE9_3D_BULLET_38_SKIP', JSON.stringify({ backend, required: 'BulletWorld' }));
        return;
    }

    const previous = { enabled: system.enable, autoSimulation: system.autoSimulation, paused: game.isPaused() };
    const specs = [
        { name: 'static-trigger', trigger: true, body: 'none' },
        { name: 'dynamic-trigger', trigger: true, body: 'dynamic' },
        { name: 'dynamic-collision', trigger: false, body: 'dynamic' },
        { name: 'kinematic-collision', trigger: false, body: 'kinematic' },
    ];
    const nodes = [];
    const events = [];
    let afterPhysicsFrames = 0;
    const onAfterPhysics = () => { afterPhysicsFrames += 1; };
    const names = ['onTriggerEnter', 'onCollisionEnter'];

    function createNode(spec, index, side) {
        const node = new Node(`stage9-${spec.name}-${side}`);
        node.active = false;
        node.setPosition(20000 + index * 20, 20000, 0);
        scene.addChild(node);
        nodes.push(node);
        const body = side === 'A' && spec.body !== 'none' ? node.addComponent(RigidBody) : null;
        if (body) {
            body.type = spec.body === 'kinematic' ? RigidBody.Type.KINEMATIC : RigidBody.Type.DYNAMIC;
            body.useGravity = false;
            body.allowSleep = false;
        }
        const collider = node.addComponent(BoxCollider);
        node.active = true;
        collider.size = new Vec3(2, 2, 2);
        collider.isTrigger = side === 'A' && spec.trigger;
        names.forEach((eventName) => collider.on(eventName, (event) => {
            if (events.length < 60) events.push({
                case: spec.name, side, listener: eventName, type: event && event.type,
                frame: director.getTotalFrames(), physicsFrames: afterPhysicsFrames,
                self: event && event.selfCollider && event.selfCollider.node.name,
                other: event && event.otherCollider && event.otherCollider.node.name,
                contacts: event && event.contacts && event.contacts.length,
            });
        }));
        return { node, collider, body };
    }

    try {
        system.enable = true;
        system.autoSimulation = true;
        director.on(Director.EVENT_AFTER_PHYSICS, onAfterPhysics);
        const pairs = specs.map((spec, index) => ({
            spec, a: createNode(spec, index, 'A'), b: createNode(spec, index, 'B'),
        }));
        if (previous.paused) game.resume();
        await new Promise((resolve) => setTimeout(resolve, 1500));
        console.log('STAGE9_3D_BULLET_38', JSON.stringify({
            version: '3.8.7', environment: 'Creator Web preview', scene: scene.name,
            backend, previous, afterPhysicsFrames,
            pairs: pairs.map(({ spec, a, b }) => ({
                name: spec.name, triggerA: a.collider.isTrigger, triggerB: b.collider.isTrigger,
                bodyA: spec.body, bodyType: a.body && a.body.type,
                bodyImplReady: !a.body || Boolean(a.body.body),
                a: a.node.name, b: b.node.name,
                groupA: a.collider.getGroup(), groupB: b.collider.getGroup(),
                maskA: a.collider.getMask(), maskB: b.collider.getMask(),
            })), events,
        }));
    } catch (error) {
        console.error('STAGE9_3D_BULLET_38_ERROR', error, JSON.stringify({ backend, afterPhysicsFrames, events }));
    } finally {
        director.off(Director.EVENT_AFTER_PHYSICS, onAfterPhysics);
        nodes.forEach((node) => { node.removeFromParent(); node.destroy(); });
        system.enable = previous.enabled;
        system.autoSimulation = previous.autoSimulation;
        if (previous.paused) game.pause();
    }
})();
