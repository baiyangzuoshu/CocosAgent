// Run after the Creator 3.8.7 Web preview scene is ready.
// Two isolated overlapping Dynamic sensor pairs differ only in listener setting.
(async () => {
    let api;
    try { api = await System.import('cc'); }
    catch (error) { console.error('STAGE9_CONTACT_38_ERROR', 'cc import failed', error); return; }
    const { Node, RigidBody2D, BoxCollider2D, PhysicsSystem2D,
        ERigidBody2DType, Contact2DType, Size, director, game } = api;
    if (!PhysicsSystem2D.PHYSICS_BOX2D || !RigidBody2D || !BoxCollider2D) {
        console.error('STAGE9_CONTACT_38_ERROR', 'TypeScript Box2D unavailable');
        return;
    }
    const system = PhysicsSystem2D.instance;
    const world = system.physicsWorld;
    const previousPaused = game.isPaused();
    const nodes = [];
    const events = [];
    const label = (collider) => collider?.node?.name || null;
    const systemBegin = (a, b, contact) => events.push({
        owner: 'system', kind: 'begin', a: label(a), b: label(b), contact: Boolean(contact),
    });
    const systemEnd = (a, b, contact) => events.push({
        owner: 'system', kind: 'end', a: label(a), b: label(b), contact: Boolean(contact),
    });
    system.on(Contact2DType.BEGIN_CONTACT, systemBegin);
    system.on(Contact2DType.END_CONTACT, systemEnd);
    try {
        if (!previousPaused) game.pause();
        const make = (name, x, listen) => {
            const node = new Node(name);
            node.active = false;
            director.getScene().addChild(node);
            node.setPosition(x, 20000, 0);
            const body = node.addComponent(RigidBody2D);
            body.type = ERigidBody2DType.Dynamic;
            body.gravityScale = 0;
            body.enabledContactListener = listen;
            const collider = node.addComponent(BoxCollider2D);
            collider.sensor = true;
            collider.size = new Size(100, 100);
            collider.on(Contact2DType.BEGIN_CONTACT, (self, other, contact) => events.push({
                owner: name, kind: 'begin', a: label(self), b: label(other), contact: Boolean(contact),
            }));
            nodes.push(node);
            node.active = true;
            return { body, collider };
        };
        const noA = make('no-listener-a', 20000, false);
        const noB = make('no-listener-b', 20000, false);
        const yesA = make('listener-a', 21000, true);
        const yesB = make('listener-b', 21000, false);
        await new Promise((resolve) => setTimeout(resolve, 100));
        const readiness = [noA, noB, yesA, yesB].map(({ body, collider }) => ({
            name: collider.node.name, bodyImpl: Boolean(body.impl), shapeImpl: Boolean(collider.impl),
            listen: body.enabledContactListener,
        }));
        world.syncSceneToPhysics();
        world.step(0.05, 10, 10);
        world.step(0.05, 10, 10);
        const afterOverlap = events.slice();
        yesB.collider.enabled = false;
        world.step(0.05, 10, 10);
        console.log('STAGE9_CONTACT_38', JSON.stringify({
            version: '3.8.7', backend: world.constructor.name,
            method: 'game paused; direct Box2D world.step(0.05)',
            readiness, afterOverlap, afterDisable: events.slice(),
        }));
    } catch (error) {
        console.error('STAGE9_CONTACT_38_ERROR', error, JSON.stringify(events));
    } finally {
        system.off(Contact2DType.BEGIN_CONTACT, systemBegin);
        system.off(Contact2DType.END_CONTACT, systemEnd);
        for (const node of nodes) { node.removeFromParent(); node.destroy(); }
        if (!previousPaused) game.resume();
    }
})();
