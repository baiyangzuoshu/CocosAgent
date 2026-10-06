// Creator 2.4.15 Web preview only; paste into DevTools after the scene is ready.
// Compare changing enabledContactListener after fixture creation with toggling
// the collider off/on to recreate its Box2D fixture. Uses manual Box2D steps.
(async function () {
    var director = cc.director;
    var scene = director.getScene();
    var physics = director.getPhysicsManager();
    if (!scene || !physics || !cc.RigidBody || !cc.PhysicsBoxCollider) {
        console.error('STAGE9_REGISTRATION_24_ERROR', '2D Box2D APIs unavailable');
        return;
    }

    var previous = {
        paused: cc.game.isPaused(),
        enabled: physics.enabled,
        flags: physics.debugDrawFlags,
    };
    var nodes = [];
    var events = [];
    var Receiver = cc.Class({
        extends: cc.Component,
        onBeginContact: function (contact, self, other) {
            events.push({ kind: 'begin', self: self.node.name, other: other.node.name });
        },
    });
    var make = function (name, x, listen) {
        var node = new cc.Node(name);
        node.active = false;
        scene.addChild(node);
        node.setPosition(x, 20000);
        node.addComponent(Receiver);
        var body = node.addComponent(cc.RigidBody);
        body.type = cc.RigidBodyType.Dynamic;
        body.gravityScale = 0;
        body.enabledContactListener = listen;
        var collider = node.addComponent(cc.PhysicsBoxCollider);
        collider.sensor = true;
        collider.size = cc.size(100, 100);
        nodes.push(node);
        node.active = true;
        return { body: body, collider: collider };
    };
    var fixtureState = function (pair) {
        var registry = physics._contactListener && physics._contactListener._contactFixtures;
        var fixtures = pair.collider._fixtures || [];
        return {
            name: pair.collider.node.name,
            listen: pair.body.enabledContactListener,
            fixtureCount: fixtures.length,
            registeredCount: registry ? fixtures.filter(function (fixture) {
                return registry.indexOf(fixture) !== -1;
            }).length : null,
        };
    };

    try {
        physics.enabled = true;
        physics.debugDrawFlags = 0;
        if (!previous.paused) cc.game.pause();

        var toggleA = make('toggle-only-a', 20000, false);
        var toggleB = make('toggle-only-b', 20000, false);
        var rebuildA = make('collider-reenable-a', 21000, false);
        var rebuildB = make('collider-reenable-b', 21000, false);
        await new Promise(function (resolve) { setTimeout(resolve, 100); });

        toggleA.body.enabledContactListener = true;
        rebuildA.body.enabledContactListener = true;
        rebuildA.collider.enabled = false;
        rebuildA.collider.enabled = true;
        var readiness = [toggleA, toggleB, rebuildA, rebuildB].map(fixtureState);

        physics.update(0.05);
        physics.update(0.05);
        console.log('STAGE9_REGISTRATION_24', JSON.stringify({
            version: '2.4.15',
            creatorVersion: '2.4.15',
            environment: 'Creator Web preview',
            backend: 'Box2D',
            method: 'game paused; toggle one body after fixture creation; disable/enable the other Collider; PhysicsManager.update(0.05) twice',
            previousPaused: previous.paused,
            readiness: readiness,
            events: events,
        }));
    } catch (error) {
        console.error('STAGE9_REGISTRATION_24_ERROR', error, JSON.stringify(events));
    } finally {
        nodes.forEach(function (node) {
            node.removeFromParent();
            node.destroy();
        });
        physics.debugDrawFlags = previous.flags;
        physics.enabled = previous.enabled;
        if (previous.paused) cc.game.pause();
        else cc.game.resume();
    }
})();
