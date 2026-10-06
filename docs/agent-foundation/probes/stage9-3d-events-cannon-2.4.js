// Creator 2.4.15 Web preview with CannonWorld; run after the scene is ready.
// Temporary overlap pairs test event names and Cannon body types on natural frames.
(async () => {
    const manager = cc.director.getPhysics3DManager();
    const scene = cc.director.getScene();
    const backend = manager && manager.physicsWorld && manager.physicsWorld.constructor.name;
    if (!scene || !manager || backend !== 'CannonWorld' || !cc.RigidBody3D || !cc.BoxCollider3D) {
        console.error('STAGE9_3D_CANNON_24_SKIP', JSON.stringify({ backend, required: 'CannonWorld' }));
        return;
    }

    const previous = { enabled: manager.enabled, paused: cc.game.isPaused() };
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
    const names = ['trigger-enter', 'collision-enter', 'onTriggerEnter', 'onCollisionEnter'];

    function createNode(spec, index, side) {
        const node = new cc.Node(`stage9-${spec.name}-${side}`);
        node.active = false;
        node.setPosition(20000 + index * 20, 20000, 0);
        scene.addChild(node);
        nodes.push(node);
        const body = side === 'A' && spec.body !== 'none' ? node.addComponent(cc.RigidBody3D) : null;
        const collider = node.addComponent(cc.BoxCollider3D);
        node.active = true;
        if (body) {
            if (!body.rigidBody) throw new Error(`${spec.name}: RigidBody3D wrapper unavailable`);
            body.useGravity = false;
            body.allowSleep = false;
            body.isKinematic = spec.body === 'kinematic';
        }
        collider.size = new cc.Vec3(2, 2, 2);
        collider.isTrigger = side === 'A' && spec.trigger;
        names.forEach((eventName) => collider.on(eventName, (event) => {
            if (events.length < 60) events.push({
                case: spec.name, side, listener: eventName, type: event && event.type,
                frame: cc.director.getTotalFrames(), physicsFrames: afterPhysicsFrames,
                self: event && event.selfCollider && event.selfCollider.node.name,
                other: event && event.otherCollider && event.otherCollider.node.name,
                contacts: event && event.contacts && event.contacts.length,
            });
        }));
        return { node, collider, body };
    }

    try {
        manager.enabled = true;
        cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, onAfterPhysics);
        const pairs = specs.map((spec, index) => ({
            spec, a: createNode(spec, index, 'A'), b: createNode(spec, index, 'B'),
        }));
        if (previous.paused) cc.game.resume();
        await new Promise((resolve) => setTimeout(resolve, 600));
        console.log('STAGE9_3D_CANNON_24', JSON.stringify({
            version: '2.4.15', environment: 'Creator Web preview', scene: scene.name,
            backend, previous, afterPhysicsFrames,
            pairs: pairs.map(({ spec, a, b }) => ({
                name: spec.name, triggerA: a.collider.isTrigger, triggerB: b.collider.isTrigger,
                bodyA: spec.body, bodyWrapperReady: !a.body || Boolean(a.body.rigidBody),
                massA: a.body ? a.body.mass : null,
                isKinematicA: a.body ? a.body.isKinematic : null,
                cannonBodyTypeA: a.body ? a.body.rigidBody._sharedBody.body.type : null,
                a: a.node.name, b: b.node.name,
                groupA: a.node.groupIndex, groupB: b.node.groupIndex,
                collisionMatrixRowA: cc.game.collisionMatrix[a.node.groupIndex],
            })), events,
        }));
    } catch (error) {
        console.error('STAGE9_3D_CANNON_24_ERROR', error, JSON.stringify({ backend, afterPhysicsFrames, events }));
    } finally {
        cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, onAfterPhysics);
        nodes.forEach((node) => { node.removeFromParent(); node.destroy(); });
        manager.enabled = previous.enabled;
        if (previous.paused) cc.game.pause();
    }
})();
