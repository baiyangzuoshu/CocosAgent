// Creator 3.8.7 Web preview: temporary moving TypeScript Box2D sensor pair.
// Records the moving body's Box2D and node positions in natural frame phases.
(async function () {
    var api = await System.import('cc');
    var director = api.director;
    var scene = director.getScene();
    var system = api.PhysicsSystem2D.instance;
    var system3D = api.PhysicsSystem.instance;
    var previous = { enabled: system.enable, autoSimulation: system.autoSimulation,
        paused: api.game.isPaused() };
    var originalPost2D = system.postUpdate;
    var originalPost3D = system3D && system3D.postUpdate;
    var systemPhase = null;
    var nodes = [];
    var marks = [];
    var frame = function () { return director.getTotalFrames(); };
    var moving;
    var firstContactFrame = null;
    function sample(kind) {
        if (!moving || marks.length > 50) return;
        var body = moving.getComponent(api.RigidBody2D);
        var wrapper = body.impl;
        var nativeBody = wrapper && wrapper.impl;
        var pos = nativeBody && nativeBody.GetPosition();
        marks.push({ kind: kind, frame: frame(), systemPhase: systemPhase,
            nodeX: moving.worldPosition.x,
            bodyX: pos ? pos.x * 32 : null, bodyReady: Boolean(nativeBody) });
    }
    var counts = { before: 0, after: 0, beforePhysics: 0, afterPhysics: 0 };
    function mark(kind, key) { return function () { if (counts[key]++ < 5) sample(kind); }; }
    var before = mark('beforeUpdate', 'before');
    var after = mark('afterUpdate', 'after');
    var beforePhysics = mark('beforePhysics', 'beforePhysics');
    var afterPhysics = mark('afterPhysics', 'afterPhysics');
    var Reader = class extends api.Component {
        update() { if (this.node === moving && marks.length < 50) sample('componentUpdate'); }
        lateUpdate() { if (this.node === moving && marks.length < 50) sample('componentLateUpdate'); }
    };
    function cleanup() {
        director.off(api.Director.EVENT_BEFORE_UPDATE, before);
        director.off(api.Director.EVENT_AFTER_UPDATE, after);
        director.off(api.Director.EVENT_BEFORE_PHYSICS, beforePhysics);
        director.off(api.Director.EVENT_AFTER_PHYSICS, afterPhysics);
        system.postUpdate = originalPost2D;
        if (system3D) system3D.postUpdate = originalPost3D;
        nodes.forEach(function (node) { node.removeFromParent(); node.destroy(); });
        system.enable = previous.enabled;
        system.autoSimulation = previous.autoSimulation;
        if (previous.paused) api.game.pause();
    }
    try {
        system.enable = true;
        system.autoSimulation = true;
        system.postUpdate = function () { var old = systemPhase; systemPhase = '2D';
            try { return originalPost2D.apply(this, arguments); } finally { systemPhase = old; } };
        if (system3D) system3D.postUpdate = function () { var old = systemPhase; systemPhase = '3D';
            try { return originalPost3D.apply(this, arguments); } finally { systemPhase = old; } };
        director.on(api.Director.EVENT_BEFORE_UPDATE, before);
        director.on(api.Director.EVENT_AFTER_UPDATE, after);
        director.on(api.Director.EVENT_BEFORE_PHYSICS, beforePhysics);
        director.on(api.Director.EVENT_AFTER_PHYSICS, afterPhysics);
        ['moving-a', 'stationary-b'].forEach(function (name, index) {
            var node = new api.Node(name);
            node.active = false;
            scene.addChild(node);
            node.setPosition(120000, 120000, 0);
            node.addComponent(Reader);
            var body = node.addComponent(api.RigidBody2D);
            body.type = api.ERigidBody2DType.Dynamic;
            body.gravityScale = 0;
            body.enabledContactListener = true;
            // 3.8 Box2D velocity is in physics meters/s; 10 m/s = 320 scene units/s.
            body.linearVelocity = new api.Vec2(index === 0 ? 10 : 0, 0);
            var collider = node.addComponent(api.BoxCollider2D);
            collider.sensor = true;
            collider.size = new api.Size(100, 100);
            collider.on(api.Contact2DType.BEGIN_CONTACT, function (self) {
                if (firstContactFrame === null) firstContactFrame = frame();
                if (frame() === firstContactFrame) sample('beginContact:' + self.node.name);
            });
            nodes.push(node);
            if (index === 0) moving = node;
            node.active = true;
        });
        if (previous.paused) api.game.resume();
        await new Promise(function (resolve) { setTimeout(resolve, 1500); });
        console.log('STAGE9_MOVING_38', JSON.stringify({ version: '3.8.7', scene: scene.name,
            backend: system.physicsWorld.constructor.name, previous: previous,
            endFrame: frame(), firstContactFrame: firstContactFrame, marks: marks }));
        cleanup();
    } catch (error) {
        console.error('STAGE9_MOVING_38_ERROR', String(error), JSON.stringify(marks));
        cleanup();
    }
})();
