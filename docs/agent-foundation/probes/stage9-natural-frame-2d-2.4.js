// Creator 2.4.15 Web preview only; paste into DevTools after the scene is ready.
// Creates two temporary overlapping Dynamic Box2D sensors, lets natural
// Director frames run, logs callback/frame/sync markers, then removes the nodes.
(async function () {
    var director = cc.director;
    var scene = director.getScene();
    var physics = director.getPhysicsManager();
    if (!scene || !physics || !cc.RigidBody || !cc.PhysicsBoxCollider) {
        console.error('STAGE9_NATURAL_24_ERROR', '2D Box2D APIs unavailable');
        return;
    }

    var previous = {
        paused: cc.game.isPaused(),
        enabled: Boolean(physics.enabled),
        debugDrawFlags: physics.debugDrawFlags,
    };
    var nodes = [];
    var marks = [];
    var phaseCounts = { beforeUpdate: 0, afterUpdate: 0 };
    var frame = function () { return director._totalFrames; };
    var positions = function () {
        return nodes.map(function (node) {
            return { name: node.name, xy: [node.x, node.y] };
        });
    };
    var beforeUpdate = function (dt) {
        if (phaseCounts.beforeUpdate++ < 4) {
            marks.push({ kind: 'beforeUpdate', frame: frame(), dt: dt, positions: positions() });
        }
    };
    var afterUpdate = function (dt) {
        if (phaseCounts.afterUpdate++ < 4) {
            marks.push({ kind: 'afterUpdate', frame: frame(), dt: dt, positions: positions() });
        }
    };
    var Receiver = cc.Class({
        extends: cc.Component,
        onBeginContact: function (contact, self, other) {
            marks.push({
                kind: 'beginContact', frame: frame(),
                self: self.node.name, other: other.node.name,
                nodeXY: [this.node.x, this.node.y], hasContact: !!contact,
            });
        },
    });

    function cleanup() {
        director.off(cc.Director.EVENT_BEFORE_UPDATE, beforeUpdate);
        director.off(cc.Director.EVENT_AFTER_UPDATE, afterUpdate);
        nodes.forEach(function (node) {
            node.removeFromParent();
            node.destroy();
        });
        physics.debugDrawFlags = previous.debugDrawFlags;
        physics.enabled = previous.enabled;
        if (previous.paused) cc.game.pause();
    }

    try {
        physics.enabled = true;
        physics.debugDrawFlags = 0;
        director.on(cc.Director.EVENT_BEFORE_UPDATE, beforeUpdate);
        director.on(cc.Director.EVENT_AFTER_UPDATE, afterUpdate);

        ['natural-frame-a', 'natural-frame-b'].forEach(function (name) {
            var node = new cc.Node(name);
            node.active = false;
            scene.addChild(node);
            node.setPosition(120000, 120000);
            node.addComponent(Receiver);
            var body = node.addComponent(cc.RigidBody);
            body.type = cc.RigidBodyType.Dynamic;
            body.gravityScale = 0;
            body.enabledContactListener = true;
            var collider = node.addComponent(cc.PhysicsBoxCollider);
            collider.sensor = true;
            collider.size = cc.size(100, 100);
            nodes.push(node);
            node.active = true;
        });

        if (previous.paused) cc.game.resume();
        await new Promise(function (resolve) { setTimeout(resolve, 500); });
        console.log('STAGE9_NATURAL_24', JSON.stringify({
            version: '2.4.15',
            creatorVersion: '2.4.15',
            environment: 'Creator Web preview / Chrome DevTools',
            scene: scene.name,
            backend: 'Box2D',
            gamePausedBefore: previous.paused,
            physicsEnabledBefore: previous.enabled,
            frame: frame(),
            bodyReady: nodes.map(function (node) {
                var body = node.getComponent(cc.RigidBody);
                return { name: node.name, bodyImpl: !!body._b2Body };
            }),
            marks: marks,
        }));
        cleanup();
    } catch (error) {
        console.error('STAGE9_NATURAL_24_ERROR', error, JSON.stringify(marks));
        cleanup();
    }
})();
