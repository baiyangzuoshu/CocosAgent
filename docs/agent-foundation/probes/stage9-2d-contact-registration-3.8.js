// Creator 3.8.7 Web preview / TypeScript Box2D only.
// Compare changing enabledContactListener after fixture creation with calling
// Collider2D.apply() after that change. Lets initial node dirtiness clear in
// natural frames, then pauses and directly steps the World.
(async function () {
    var api;
    try { api = await System.import('cc'); }
    catch (error) {
        console.error('STAGE9_REGISTRATION_38_ERROR', 'cc import failed', error);
        return;
    }

    var Node = api.Node;
    var RigidBody2D = api.RigidBody2D;
    var BoxCollider2D = api.BoxCollider2D;
    var PhysicsSystem2D = api.PhysicsSystem2D;
    var ERigidBody2DType = api.ERigidBody2DType;
    var Contact2DType = api.Contact2DType;
    var Size = api.Size;
    var director = api.director;
    var game = api.game;
    if (!PhysicsSystem2D.PHYSICS_BOX2D) {
        console.error('STAGE9_REGISTRATION_38_ERROR', 'TypeScript Box2D unavailable');
        return;
    }

    var system = PhysicsSystem2D.instance;
    var world = system.physicsWorld;
    if (!world || world.constructor.name !== 'b2PhysicsWorld') {
        console.error('STAGE9_REGISTRATION_38_ERROR', 'active World is not TypeScript Box2D', world && world.constructor.name);
        return;
    }
    var previous = { paused: game.isPaused(), flags: system.debugDrawFlags };
    var nodes = [];
    var events = [];
    var phase = 'setup';
    var fixtureCountAtEvent = function () {
        var listener = world._contactListener;
        return listener && listener._contactFixtures && listener._contactFixtures.length;
    };
    var systemBegin = function (a, b) {
        events.push({ owner: 'system', phase: phase, registeredTotal: fixtureCountAtEvent(), a: a.node.name, b: b.node.name });
    };
    var make = function (name, x, listen) {
        var node = new Node(name);
        node.active = false;
        director.getScene().addChild(node);
        node.setPosition(x, 20000, 0);
        var body = node.addComponent(RigidBody2D);
        body.type = ERigidBody2DType.Dynamic;
        body.gravityScale = 0;
        body.enabledContactListener = listen;
        var collider = node.addComponent(BoxCollider2D);
        collider.sensor = true;
        collider.size = new Size(100, 100);
        collider.on(Contact2DType.BEGIN_CONTACT, function (self, other) {
            events.push({ owner: name, phase: phase, registeredTotal: fixtureCountAtEvent(), a: self.node.name, b: other.node.name });
        });
        nodes.push(node);
        node.active = true;
        return { body: body, collider: collider };
    };
    var fixtureState = function (pair) {
        var registry = world._contactListener && world._contactListener._contactFixtures;
        var fixtures = pair.collider.impl && pair.collider.impl._fixtures || [];
        return {
            name: pair.collider.node.name,
            listen: pair.body.enabledContactListener,
            fixtureCount: fixtures.length,
            registeredCount: registry ? fixtures.filter(function (f) {
                return registry.indexOf(f) !== -1;
            }).length : null,
        };
    };

    system.on(Contact2DType.BEGIN_CONTACT, systemBegin);
    try {
        system.debugDrawFlags = 0;

        var createdFrame = director.getTotalFrames();
        var toggleA = make('toggle-only-a', 20000, false);
        var toggleB = make('toggle-only-b', 20200, false);
        var applyA = make('apply-rebuild-a', 21000, false);
        var applyB = make('apply-rebuild-b', 21200, false);
        if (previous.paused) game.resume();
        await new Promise(function (resolve) { setTimeout(resolve, 1000); });
        game.pause();
        var settledFrame = director.getTotalFrames();
        world.syncSceneToPhysics();
        var beforeToggle = [toggleA, toggleB, applyA, applyB].map(fixtureState);
        var beforeToggleFlags = nodes.map(function (node) {
            return { name: node.name, flags: node.hasChangedFlags };
        });

        toggleA.body.enabledContactListener = true;
        applyA.body.enabledContactListener = true;
        applyA.collider.apply();
        toggleB.collider.node.setPosition(20000, 20000, 0);
        applyB.collider.node.setPosition(21000, 20000, 0);
        var readiness = [toggleA, toggleB, applyA, applyB].map(fixtureState);

        phase = 'step1';
        world.syncSceneToPhysics();
        var afterSync = [toggleA, toggleB, applyA, applyB].map(fixtureState);
        world.step(0.05, 10, 10);
        var afterStep1 = [toggleA, toggleB, applyA, applyB].map(fixtureState);
        phase = 'step2';
        world.step(0.05, 10, 10);
        var afterStep2 = [toggleA, toggleB, applyA, applyB].map(fixtureState);
        console.log('STAGE9_REGISTRATION_38', JSON.stringify({
            version: '3.8.7',
            creatorVersion: '3.8.7',
            environment: 'Creator Web preview',
            backend: world.constructor.name,
            method: 'initial fixtures settle during natural frames; pause; toggle one body after fixture creation; call Collider2D.apply() for the other; move separated pairs into overlap; direct world.step(0.05) twice',
            previousPaused: previous.paused,
            createdFrame: createdFrame,
            settledFrame: settledFrame,
            beforeToggleFlags: beforeToggleFlags,
            beforeToggle: beforeToggle,
            readiness: readiness,
            afterSync: afterSync,
            afterStep1: afterStep1,
            afterStep2: afterStep2,
            events: events,
        }));
    } catch (error) {
        console.error('STAGE9_REGISTRATION_38_ERROR', error, JSON.stringify(events));
    } finally {
        system.off(Contact2DType.BEGIN_CONTACT, systemBegin);
        nodes.forEach(function (node) {
            node.removeFromParent();
            node.destroy();
        });
        system.debugDrawFlags = previous.flags;
        if (!previous.paused) game.resume();
    }
})();
