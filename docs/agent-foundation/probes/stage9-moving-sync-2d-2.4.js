// Creator 2.4.15 Web preview: temporary moving Box2D sensor pair.
// Records the moving body's Box2D and node positions in natural frame phases.
(async function () {
    var director = cc.director;
    var physics = director.getPhysicsManager();
    var scene = director.getScene();
    var previous = { enabled: Boolean(physics.enabled), paused: cc.game.isPaused() };
    var nodes = [];
    var marks = [];
    var frame = function () { return director._totalFrames; };
    var moving;
    var firstContactFrame = null;
    function sample(kind) {
        if (!moving || marks.length > 35) return;
        var body = moving.getComponent(cc.RigidBody);
        var pos = body.getWorldPosition();
        marks.push({ kind: kind, frame: frame(), nodeX: moving.x, bodyX: pos.x,
            bodyReady: Boolean(body._b2Body) });
    }
    var phaseCounts = { before: 0, after: 0 };
    var before = function () { if (phaseCounts.before++ < 5) sample('beforeUpdate'); };
    var after = function () { if (phaseCounts.after++ < 5) sample('afterUpdate'); };
    var Reader = cc.Class({
        extends: cc.Component,
        update: function () { if (this.node === moving && marks.length < 35) sample('componentUpdate'); },
        lateUpdate: function () { if (this.node === moving && marks.length < 35) sample('componentLateUpdate'); },
        onBeginContact: function (contact, self, other) {
            if (firstContactFrame === null) firstContactFrame = frame();
            if (frame() === firstContactFrame) sample('beginContact:' + self.node.name);
        },
    });
    function cleanup() {
        director.off(cc.Director.EVENT_BEFORE_UPDATE, before);
        director.off(cc.Director.EVENT_AFTER_UPDATE, after);
        nodes.forEach(function (node) { node.removeFromParent(); node.destroy(); });
        physics.enabled = previous.enabled;
        if (previous.paused) cc.game.pause();
    }
    try {
        physics.enabled = true;
        director.on(cc.Director.EVENT_BEFORE_UPDATE, before);
        director.on(cc.Director.EVENT_AFTER_UPDATE, after);
        ['moving-a', 'stationary-b'].forEach(function (name, index) {
            var node = new cc.Node(name);
            node.active = false;
            scene.addChild(node);
            node.setPosition(120000, 120000);
            node.addComponent(Reader);
            var body = node.addComponent(cc.RigidBody);
            body.type = cc.RigidBodyType.Dynamic;
            body.gravityScale = 0;
            body.enabledContactListener = true;
            body.linearVelocity = cc.v2(index === 0 ? 320 : 0, 0);
            var collider = node.addComponent(cc.PhysicsBoxCollider);
            collider.sensor = true;
            collider.size = cc.size(100, 100);
            nodes.push(node);
            if (index === 0) moving = node;
            node.active = true;
        });
        if (previous.paused) cc.game.resume();
        await new Promise(function (resolve) { setTimeout(resolve, 500); });
        console.log('STAGE9_MOVING_24', JSON.stringify({ version: '2.4.15', scene: scene.name,
            backend: 'Box2D', previous: previous, endFrame: frame(), firstContactFrame: firstContactFrame,
            marks: marks }));
        cleanup();
    } catch (error) {
        console.error('STAGE9_MOVING_24_ERROR', String(error), JSON.stringify(marks));
        cleanup();
    }
})();
