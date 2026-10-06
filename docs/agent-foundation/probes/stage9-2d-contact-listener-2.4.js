// Creator 2.4.15 Web preview: three isolated Dynamic sensor pairs.
// Run only in a disposable preview. The script pauses the game, steps Box2D
// through PhysicsManager.update twice, then restores the previous manager state.
(async () => {
    const scene = cc.director.getScene();
    const physics = cc.director.getPhysicsManager();
    if (!scene || !physics || !cc.RigidBody || !cc.PhysicsBoxCollider) {
        console.error('STAGE9_CONTACT_24_ERROR', '2D physics unavailable');
        return;
    }
    const previous = {
        paused: cc.game.isPaused(),
        enabled: physics.enabled,
        debugDrawFlags: physics.debugDrawFlags,
    };
    const nodes = [];
    const events = [];
    const Receiver = cc.Class({
        extends: cc.Component,
        onBeginContact(contact, self, other) {
            events.push({ owner: this.node.name, kind: 'begin',
                self: self.node.name, other: other.node.name,
                contact: !!contact });
        },
        onEndContact(contact, self, other) {
            events.push({ owner: this.node.name, kind: 'end',
                self: self.node.name, other: other.node.name,
                contact: !!contact });
        },
    });
    try {
        if (!previous.paused) cc.game.pause();
        physics.enabled = true;
        physics.debugDrawFlags = 0;
        const make = (name, x, listen) => {
            const node = new cc.Node(name);
            node.active = false;
            scene.addChild(node);
            node.setPosition(x, 20000);
            node.addComponent(Receiver);
            const body = node.addComponent(cc.RigidBody);
            body.type = cc.RigidBodyType.Dynamic;
            body.gravityScale = 0;
            body.enabledContactListener = listen;
            const collider = node.addComponent(cc.PhysicsBoxCollider);
            collider.sensor = true;
            collider.size = cc.size(100, 100);
            nodes.push(node);
            node.active = true;
            return { body, collider };
        };
        const noA = make('no-listener-a', 20000, false);
        const noB = make('no-listener-b', 20000, false);
        const yesA = make('listener-a', 21000, true);
        const yesB = make('listener-b', 21000, false);
        const lateA = make('late-listener-a', 22000, false);
        const lateB = make('late-listener-b', 22000, false);
        await new Promise((resolve) => setTimeout(resolve, 100));
        lateA.body.enabledContactListener = true;
        const registered = physics._contactListener._contactFixtures;
        const readiness = [noA, noB, yesA, yesB, lateA, lateB].map(({ body, collider }) => ({
            name: collider.node.name,
            bodyImpl: !!body._b2Body,
            fixtureCount: collider._fixtures ? collider._fixtures.length : 0,
            listen: body.enabledContactListener,
            registered: !!(collider._fixtures &&
                collider._fixtures.some((fixture) => registered.indexOf(fixture) !== -1)),
        }));
        physics.update(0.05);
        physics.update(0.05);
        const afterOverlap = events.slice();
        yesB.collider.enabled = false;
        physics.update(0.05);
        console.log('STAGE9_CONTACT_24', JSON.stringify({
            version: '2.4.15', backend: 'Box2D',
            method: 'game paused; PhysicsManager.update(0.05) twice; late listener enabled after fixture creation',
            readiness, afterOverlap, afterDisable: events.slice(),
        }));
    } catch (error) {
        console.error('STAGE9_CONTACT_24_ERROR', error, JSON.stringify(events));
    } finally {
        for (const node of nodes) { node.removeFromParent(); node.destroy(); }
        physics.debugDrawFlags = previous.debugDrawFlags;
        physics.enabled = previous.enabled;
        if (!previous.paused) cc.game.resume();
    }
})();
