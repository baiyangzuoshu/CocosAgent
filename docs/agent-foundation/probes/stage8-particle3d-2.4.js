// Paste into the Creator 2.4.15 Web preview DevTools console.
// Uses a temporary node and the real ParticleSystem3D component; no scene asset is edited.
(() => {
    const scene = cc.director.getScene();
    if (!scene || !cc.ParticleSystem3D) {
        console.error('STAGE8_PARTICLE3D_24_ERROR', 'Scene or ParticleSystem3D unavailable');
        return;
    }

    const wasPaused = cc.game.isPaused();
    const samples = [];
    let node;
    let ps;
    cc.game.pause();
    try {
        node = new cc.Node('stage8-particle3d-probe');
        scene.addChild(node);
        ps = node.addComponent(cc.ParticleSystem3D);
        ps.stop(); // onEnable may have started PlayOnAwake before parameters were set.
        ps.loop = false;
        ps.duration = 0.2;
        ps.startDelay.constant = 0;
        ps.startLifetime.constant = 0.3;
        ps.rateOverTime.constant = 30;
        ps.rateOverDistance.constant = 0;
        ps.startSpeed.constant = 0;
        ps.simulationSpeed = 1;

        const snap = (phase, step) => samples.push({
            phase, step, time: ps._time, count: ps.getParticleCount(),
            liveCount: ps._assembler && ps._assembler._particles
                ? ps._assembler._particles.length : null,
            playing: ps.isPlaying, paused: ps.isPaused,
            stopped: ps.isStopped, emitting: ps.isEmitting,
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
        console.log('STAGE8_PARTICLE3D_24', JSON.stringify({
            version: '2.4.15', clock: 'direct ParticleSystem3D.update(0.05)',
            renderCulling: 'not available in this component', samples,
        }));
    } catch (error) {
        console.error('STAGE8_PARTICLE3D_24_ERROR', error, JSON.stringify(samples));
    } finally {
        if (ps) ps.stop();
        if (node) node.destroy();
        if (!wasPaused) cc.game.resume();
    }
})();
