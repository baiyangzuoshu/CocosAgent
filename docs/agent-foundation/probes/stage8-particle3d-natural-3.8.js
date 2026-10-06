// Creator 3.8.7 Web preview: observe a temporary CPU 3D particle in natural frames.
// Does not edit the scene or call ParticleSystem.update manually.
(async function () {
    var api = await System.import('cc');
    var director = api.director;
    var scene = director.getScene();
    if (!scene || !api.ParticleSystem) {
        console.error('STAGE8_PARTICLE3D_NATURAL_38_ERROR', 'scene or component unavailable');
        return;
    }
    var wasPaused = api.game.isPaused();
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
    function capture(phase) {
        api.game.pause();
        captures.push(new Promise(function (resolve) {
            window.__stage8CaptureResolve = function () {
                window.__stage8CaptureResolve = null;
                if (!wasPaused) api.game.resume();
                resolve();
            };
        }));
        console.log('STAGE8_PARTICLE3D_NATURAL_38_MARK', phase);
    }
    function snapshot(kind, dt) {
        if (marks.length >= 120) return;
        var model = ps.processor && ps.processor.getModel();
        marks.push({ kind: kind, frame: director.getTotalFrames(), dt: dt,
            updateCount: updateCount, drawCount: drawCount,
            time: ps._time, liveCount: ps.getParticleCount(),
            playing: ps.isPlaying, stopped: ps.isStopped, emitting: ps.isEmitting,
            modelExists: Boolean(model), modelAttached: Boolean(model && model.scene),
            needAttach: ps._needAttach, nodeValid: api.isValid(node) });
    }
    function afterDraw() {
        drawCount++;
        snapshot('afterDraw', null);
        var model = ps.processor && ps.processor.getModel();
        if (captureEnabled && !capturedActive && ps.getParticleCount() >= 2 && model && model.scene) {
            capturedActive = true;
            capture('active');
        } else if (captureEnabled && capturedActive && !capturedDrained && ps.isStopped) {
            capturedDrained = true;
            capture('drained');
        }
    }
    function cleanup() {
        director.off(api.Director.EVENT_AFTER_DRAW, afterDraw);
        if (ps && originalUpdate) ps.update = originalUpdate;
        if (ps) ps.stop();
        if (node) { node.removeFromParent(); node.destroy(); }
        if (wasPaused) api.game.pause();
    }
    try {
        node = new api.Node('stage8-particle3d-natural');
        node.active = false;
        scene.addChild(node);
        var camera = scene.getComponentInChildren(api.Camera);
        if (camera) {
            var p = camera.node.worldPosition;
            var forward = camera.node.forward;
            node.setWorldPosition(p.x + forward.x * 5, p.y + forward.y * 5, p.z + forward.z * 5);
        }
        ps = node.addComponent(api.ParticleSystem);
        ps.playOnAwake = false;
        ps.loop = false;
        ps.duration = 0.2;
        ps.startDelay.constant = 0;
        ps.startLifetime.constant = 0.3;
        ps.rateOverTime.constant = 30;
        ps.rateOverDistance.constant = 0;
        ps.startSpeed.constant = 0;
        ps.startSizeX.constant = 1;
        ps.startColor.color = new api.Color(255, 0, 255, 255);
        ps.simulationSpeed = 1;
        ps.renderCulling = false;
        ps.renderer.useGPU = false;
        node.active = true;
        originalUpdate = ps.update;
        ps.update = function (dt) {
            updateCount++;
            snapshot('beforeUpdate', dt);
            var result = originalUpdate.call(this, dt);
            snapshot('afterUpdate', dt);
            return result;
        };
        director.on(api.Director.EVENT_AFTER_DRAW, afterDraw);
        ps.play();
        snapshot('initial', 0);
        if (wasPaused) api.game.resume();
        for (var i = 0; i < 70 && !(ps.isStopped && updateCount >= 3 && (!captureEnabled || capturedDrained)); i++) {
            await new Promise(function (resolve) { setTimeout(resolve, 100); });
        }
        await Promise.race([Promise.all(captures), new Promise(function (resolve) { setTimeout(resolve, 5000); })]);
        snapshot('end', 0);
        console.log('STAGE8_PARTICLE3D_NATURAL_38', JSON.stringify({
            version: '3.8.7', scene: scene.name, clock: 'natural Director frames',
            previousPaused: wasPaused, camera: camera && camera.node.name,
            renderCulling: ps.renderCulling, useGPU: ps.renderer.useGPU,
            captureEnabled: captureEnabled, capturedActive: capturedActive, capturedDrained: capturedDrained,
            updateCount: updateCount, drawCount: drawCount,
            endStopped: ps.isStopped, endLiveCount: ps.getParticleCount(), marks: marks,
        }));
    } catch (error) {
        console.error('STAGE8_PARTICLE3D_NATURAL_38_ERROR', String(error), JSON.stringify(marks));
    } finally { cleanup(); }
})();
