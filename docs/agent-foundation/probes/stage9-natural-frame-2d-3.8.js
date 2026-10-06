// Creator 3.8.7 Web preview only; paste into DevTools after the scene is ready.
// Creates two temporary overlapping Dynamic Box2D sensors and records the
// natural Director/physics phase order, callback frame, and node positions.
(async function () {
    var api;
    try {
        api = await System.import('cc');
    } catch (error) {
        console.error('STAGE9_NATURAL_38_ERROR', 'cc import failed', error);
        return;
    }

    var Node = api.Node;
    var RigidBody2D = api.RigidBody2D;
    var BoxCollider2D = api.BoxCollider2D;
    var PhysicsSystem2D = api.PhysicsSystem2D;
    var PhysicsSystem = api.PhysicsSystem;
    var ERigidBody2DType = api.ERigidBody2DType;
    var Contact2DType = api.Contact2DType;
    var Size = api.Size;
    var Director = api.Director;
    var director = api.director;
    var game = api.game;
    var scene = director.getScene();
    if (!scene || !PhysicsSystem2D.PHYSICS_BOX2D) {
        console.error('STAGE9_NATURAL_38_ERROR', 'scene or TypeScript Box2D unavailable');
        return;
    }

    var system = PhysicsSystem2D.instance;
    var system3D = PhysicsSystem.instance;
    var originalPost2D = system.postUpdate;
    var originalPost3D = system3D && system3D.postUpdate;
    var systemPhase = null;
    var previous = {
        paused: game.isPaused(),
        enabled: system.enable,
        autoSimulation: system.autoSimulation,
        debugDrawFlags: system.debugDrawFlags,
    };
    var nodes = [];
    var marks = [];
    var phaseCounts = { beforeUpdate: 0, afterUpdate: 0, beforePhysics: 0, afterPhysics: 0 };
    var frame = function () { return director.getTotalFrames(); };
    var positions = function () {
        return nodes.map(function (node) {
            return { name: node.name, xy: [node.position.x, node.position.y] };
        });
    };
    var mark = function (kind, countKey) {
        return function (dt) {
            if (phaseCounts[countKey]++ < 4) {
                marks.push({ kind: kind, frame: frame(), dt: dt, systemPhase: systemPhase, positions: positions() });
            }
        };
    };
    var beforeUpdate = mark('beforeUpdate', 'beforeUpdate');
    var afterUpdate = mark('afterUpdate', 'afterUpdate');
    var beforePhysics = mark('beforePhysics', 'beforePhysics');
    var afterPhysics = mark('afterPhysics', 'afterPhysics');
    var contact = function (self, other, detail) {
        marks.push({
            kind: 'beginContact', frame: frame(),
            systemPhase: systemPhase,
            self: self.node.name, other: other.node.name,
            nodeXY: [self.node.position.x, self.node.position.y],
            hasContact: Boolean(detail),
        });
    };

    function cleanup() {
        director.off(Director.EVENT_BEFORE_UPDATE, beforeUpdate);
        director.off(Director.EVENT_AFTER_UPDATE, afterUpdate);
        director.off(Director.EVENT_BEFORE_PHYSICS, beforePhysics);
        director.off(Director.EVENT_AFTER_PHYSICS, afterPhysics);
        system.postUpdate = originalPost2D;
        if (system3D) system3D.postUpdate = originalPost3D;
        nodes.forEach(function (node) {
            node.removeFromParent();
            node.destroy();
        });
        system.enable = previous.enabled;
        system.autoSimulation = previous.autoSimulation;
        system.debugDrawFlags = previous.debugDrawFlags;
        if (previous.paused) game.pause();
    }

    try {
        system.enable = true;
        system.autoSimulation = true;
        system.debugDrawFlags = 0;
        system.postUpdate = function () {
            var old = systemPhase;
            systemPhase = '2D';
            try { return originalPost2D.apply(this, arguments); }
            finally { systemPhase = old; }
        };
        if (system3D) system3D.postUpdate = function () {
            var old = systemPhase;
            systemPhase = '3D';
            try { return originalPost3D.apply(this, arguments); }
            finally { systemPhase = old; }
        };
        director.on(Director.EVENT_BEFORE_UPDATE, beforeUpdate);
        director.on(Director.EVENT_AFTER_UPDATE, afterUpdate);
        director.on(Director.EVENT_BEFORE_PHYSICS, beforePhysics);
        director.on(Director.EVENT_AFTER_PHYSICS, afterPhysics);

        ['natural-frame-a', 'natural-frame-b'].forEach(function (name) {
            var node = new Node(name);
            node.active = false;
            scene.addChild(node);
            node.setPosition(120000, 120000, 0);
            var body = node.addComponent(RigidBody2D);
            body.type = ERigidBody2DType.Dynamic;
            body.gravityScale = 0;
            body.enabledContactListener = true;
            var collider = node.addComponent(BoxCollider2D);
            collider.sensor = true;
            collider.size = new Size(100, 100);
            collider.on(Contact2DType.BEGIN_CONTACT, contact);
            nodes.push(node);
            node.active = true;
        });

        if (previous.paused) game.resume();
        await new Promise(function (resolve) { setTimeout(resolve, 1500); });
        console.log('STAGE9_NATURAL_38', JSON.stringify({
            version: '3.8.7',
            creatorVersion: '3.8.7',
            environment: 'Creator Web preview / Chrome DevTools',
            scene: scene.name,
            backend: system.physicsWorld.constructor.name,
            gamePausedBefore: previous.paused,
                physicsEnabledBefore: previous.enabled,
                autoSimulationBefore: previous.autoSimulation,
                maxSubSteps: system.maxSubSteps,
                fixedTimeStep: system.fixedTimeStep,
            frame: frame(),
            bodyReady: nodes.map(function (node) {
                return {
                    name: node.name,
                    bodyImpl: Boolean(node.getComponent(RigidBody2D).impl),
                    colliderImpl: Boolean(node.getComponent(BoxCollider2D).impl),
                };
            }),
            marks: marks,
        }));
        cleanup();
    } catch (error) {
        console.error('STAGE9_NATURAL_38_ERROR', error, JSON.stringify(marks));
        cleanup();
    }
})();
