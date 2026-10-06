// Paste into the Creator 3.8.7 Web preview DevTools console.
// Uses a temporary node and the real 3D ParticleSystem component; no scene asset is edited.
(async () => {
    let engine;
    try {
        engine = await System.import('cc');
    } catch (error) {
        console.error('STAGE8_PARTICLE3D_38_ERROR', 'Could not import cc module', error);
        return;
    }
    const { director, game, Node, ParticleSystem } = engine;
    const scene = director.getScene();
    if (!scene || !ParticleSystem) {
        console.error('STAGE8_PARTICLE3D_38_ERROR', 'Scene or ParticleSystem unavailable');
        return;
    }

    const wasPaused = game.isPaused();
    const samples = [];
    let node;
    let ps;
    game.pause();
    try {
        node = new Node('stage8-particle3d-probe');
        scene.addChild(node);
        ps = node.addComponent(ParticleSystem);
        ps.stop(); // onEnable may have started PlayOnAwake before parameters were set.
        ps.loop = false;
        ps.duration = 0.2;
        ps.startDelay.constant = 0;
        ps.startLifetime.constant = 0.3;
        ps.rateOverTime.constant = 30;
        ps.rateOverDistance.constant = 0;
        ps.startSpeed.constant = 0;
        ps.simulationSpeed = 1;
        ps.renderCulling = false;

        const snap = (phase, step) => samples.push({
            phase, step, time: ps._time, count: ps.getParticleCount(),
            playing: ps.isPlaying, paused: ps.isPaused,
            stopped: ps.isStopped, emitting: ps.isEmitting,
            needToRestart: ps._needToRestart,
            enabled: ps.enabledInHierarchy, nodeValid: node.isValid,
        });

        ps.play();
        snap('natural', -1);
        for (let step = 0; step < 12; step++) {
            ps.update(0.05);
            snap('natural', step);
        }

        ps.stop();
        ps.play();
        ps.update(0.05);
        snap('manual', -1);
        ps.stop();
        snap('manual', 0);

        ps.play();
        ps.update(0.05);
        snap('stopEmitting', -1);
        ps.stopEmitting();
        snap('stopEmitting', 0);
        for (let step = 1; step <= 10; step++) {
            ps.update(0.05);
            snap('stopEmitting', step);
        }
        console.log('STAGE8_PARTICLE3D_38', JSON.stringify({
            version: '3.8.7', clock: 'direct ParticleSystem.update(0.05)',
            renderCulling: false, useGPU: ps.renderer.useGPU, samples,
        }));
    } catch (error) {
        console.error('STAGE8_PARTICLE3D_38_ERROR', error, JSON.stringify(samples));
    } finally {
        if (ps) ps.stop();
        if (node) node.destroy();
        if (!wasPaused) game.resume();
    }
})();
