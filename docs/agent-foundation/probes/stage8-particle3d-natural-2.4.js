// Creator 2.4.15 Web preview: observe a temporary 3D particle in natural frames.
// Does not edit the scene or call ParticleSystem3D.update manually.
(async function () {
    var director = cc.director;
    var scene = director.getScene();
    if (!scene || !cc.ParticleSystem3D) {
        console.error('STAGE8_PARTICLE3D_NATURAL_24_ERROR', 'scene or component unavailable');
        return;
    }
    var wasPaused = cc.game.isPaused();
    var node;
    var ps;
    var marks = [];
    var updateCount = 0;
    var drawCount = 0;
    var originalUpdate;
    var captureEnabled = Boolean(window.__stage8CaptureEnabled);
    var capturedActive = false;
    var capturedDrained = false;
    var captures = [];
    var camera = cc.Camera.main;
    var cameraPosition = camera && camera.node.getWorldPosition(cc.v3());
    function capture(phase) {
        cc.game.pause();
        captures.push(new Promise(function (resolve) {
            window.__stage8CaptureResolve = function () {
                window.__stage8CaptureResolve = null;
                if (!wasPaused) cc.game.resume();
                resolve();
            };
        }));
        console.log('STAGE8_PARTICLE3D_NATURAL_24_MARK', phase);
    }
    function snapshot(kind, dt) {
        if (marks.length >= 300) return;
        var assembler = ps._assembler;
        var model = assembler && assembler._model;
        marks.push({ kind: kind, frame: director._totalFrames, dt: dt,
            updateCount: updateCount, drawCount: drawCount,
            time: ps._time, liveCount: assembler && assembler._particles ? assembler._particles.length : null,
            reportedCount: ps.getParticleCount(),
            playing: ps.isPlaying, stopped: ps.isStopped, emitting: ps.isEmitting,
            modelExists: Boolean(model), modelEnabled: model ? Boolean(model.enabled) : null,
            nodeValid: cc.isValid(node) });
    }
    function afterDraw(dt) {
        drawCount++;
        snapshot('afterDraw', dt);
        if (captureEnabled && !capturedActive && ps._assembler._particles.length >= 2) {
            capturedActive = true;
            capture('active');
        } else if (captureEnabled && capturedActive && !capturedDrained && ps.isStopped) {
            capturedDrained = true;
            capture('drained');
        }
    }
    function cleanup() {
        director.off(cc.Director.EVENT_AFTER_DRAW, afterDraw);
        if (ps && originalUpdate) ps.update = originalUpdate;
        if (ps) ps.stop();
        if (node) { node.removeFromParent(); node.destroy(); }
        if (wasPaused) cc.game.pause();
    }
    try {
        node = new cc.Node('stage8-particle3d-natural');
        node.active = false;
        scene.addChild(node);
        if (!cameraPosition) throw new Error('main camera unavailable');
        node.setPosition(cameraPosition.x, cameraPosition.y, cameraPosition.z - 5);
        ps = node.addComponent(cc.ParticleSystem3D);
        ps.playOnAwake = false;
        ps.loop = false;
        ps.duration = 0.7;
        ps.startDelay.constant = 0;
        ps.startLifetime.constant = 0.5;
        ps.rateOverTime.constant = 60;
        ps.rateOverDistance.constant = 0;
        ps.startSpeed.constant = 0;
        ps.startSize.constant = 80;
        ps.startColor.color = cc.color(255, 0, 255, 255);
        ps.simulationSpeed = 1;
        node.active = true;
        originalUpdate = ps.update;
        ps.update = function (dt) {
            updateCount++;
            snapshot('beforeUpdate', dt);
            var result = originalUpdate.call(this, dt);
            snapshot('afterUpdate', dt);
            return result;
        };
        director.on(cc.Director.EVENT_AFTER_DRAW, afterDraw);
        ps.play();
        snapshot('initial', 0);
        if (wasPaused) cc.game.resume();
        for (var i = 0; i < 70 && !(ps.isStopped && updateCount >= 3 && (!captureEnabled || capturedDrained)); i++) {
            await new Promise(function (resolve) { setTimeout(resolve, 100); });
        }
        await Promise.race([Promise.all(captures), new Promise(function (resolve) { setTimeout(resolve, 5000); })]);
        snapshot('end', 0);
        console.log('STAGE8_PARTICLE3D_NATURAL_24', JSON.stringify({
            version: '2.4.15', scene: scene.name, clock: 'natural Director frames',
            previousPaused: wasPaused, cameraPosition: cameraPosition, particlePosition: node.getWorldPosition(cc.v3()),
            updateCount: updateCount, drawCount: drawCount,
            captureEnabled: captureEnabled, capturedActive: capturedActive, capturedDrained: capturedDrained,
            endStopped: ps.isStopped, endLiveCount: ps._assembler._particles.length, marks: marks,
        }));
    } catch (error) {
        console.error('STAGE8_PARTICLE3D_NATURAL_24_ERROR', String(error), JSON.stringify(marks));
    } finally { cleanup(); }
})();
