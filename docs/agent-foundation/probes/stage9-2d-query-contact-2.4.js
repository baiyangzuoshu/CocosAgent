// Paste into the Creator 2.4.15 Web preview DevTools console.
// Creates temporary nodes only; reload the preview after collecting the trace.
(async () => {
    const scene = cc.director.getScene();
    const physics = cc.director.getPhysicsManager();
    const collision = cc.director.getCollisionManager();
    if (!scene || !physics || !collision || !cc.RigidBody || !cc.PhysicsBoxCollider) {
        console.error('STAGE9_2D_24_ERROR', 'Scene or 2D physics module unavailable');
        return;
    }

    const previous = {
        physicsEnabled: physics.enabled,
        collisionEnabled: collision.enabled,
        gamePaused: cc.game.isPaused(),
    };
    const nodes = [];
    const trace = { environment: previous, method: 'Web preview, temporary nodes; collision.update called manually' };
    let capture = false;
    try {
        physics.enabled = true;
        const makePhysicsBox = (name) => {
            const node = new cc.Node(name);
            node.active = false;
            scene.addChild(node);
            node.setPosition(12000, 12000);
            const body = node.addComponent(cc.RigidBody);
            body.type = cc.RigidBodyType.Dynamic;
            body.gravityScale = 0;
            const collider = node.addComponent(cc.PhysicsBoxCollider);
            collider.size = cc.size(100, 100);
            collider.sensor = true;
            nodes.push(node);
            node.active = true;
            return collider;
        };
        const physicsA = makePhysicsBox('stage9-box2d-a');
        const physicsB = makePhysicsBox('stage9-box2d-b');
        await new Promise((resolve) => setTimeout(resolve, 150));
        const ready = [physicsA, physicsB].map((c) => !!(c._fixtures && c._fixtures.length));
        trace.box2d = { bodyType: 'Dynamic', gravityScale: 0, sensor: true, fixtureReady: ready };
        if (ready.every(Boolean)) {
            const hit = physics.testPoint(cc.v2(12000, 12000));
            trace.box2d.testPoint = {
                isArray: Array.isArray(hit),
                value: hit === physicsA ? 'a' : hit === physicsB ? 'b' : hit === null ? 'null' : String(hit),
                aabbCount: physics.testAABB(cc.rect(11950, 11950, 100, 100)).length,
            };
        }

        if (!previous.gamePaused) cc.game.pause();
        collision.enabled = true;
        const events = [];
        const Receiver = cc.Class({
            extends: cc.Component,
            onCollisionEnter(other, self) { if (capture) events.push(['Enter', other.node.name, self.node.name]); },
            onCollisionStay(other, self) { if (capture) events.push(['Stay', other.node.name, self.node.name]); },
            onCollisionExit(other, self) { if (capture) events.push(['Exit', other.node.name, self.node.name]); },
        });
        const makeSimpleBox = (name, x) => {
            const node = new cc.Node(name);
            node.active = false;
            scene.addChild(node);
            node.setPosition(x, 20000);
            node.addComponent(Receiver);
            const collider = node.addComponent(cc.BoxCollider);
            collider.size = cc.size(100, 100);
            nodes.push(node);
            node.active = true;
            return collider;
        };
        const simpleA = makeSimpleBox('stage9-simple-a', 20000);
        const simpleB = makeSimpleBox('stage9-simple-b', 20200);
        collision.update(0.05);
        capture = true;
        simpleB.node.setPosition(20000, 20000);
        collision.update(0.05);
        collision.update(0.05);
        simpleB.enabled = false;
        capture = false;
        trace.simpleCollision = {
            events,
            groupIndices: [simpleA.node.groupIndex, simpleB.node.groupIndex],
            activeMatrixEntry: cc.game.collisionMatrix[simpleA.node.groupIndex][simpleB.node.groupIndex],
        };
        console.log('STAGE9_2D_24', JSON.stringify(trace));
    } catch (error) {
        console.error('STAGE9_2D_24_ERROR', error, JSON.stringify(trace));
    } finally {
        capture = false;
        for (const node of nodes) { node.removeFromParent(); node.destroy(); }
        collision.enabled = previous.collisionEnabled;
        physics.enabled = previous.physicsEnabled;
        if (!previous.gamePaused) cc.game.resume();
    }
})();
