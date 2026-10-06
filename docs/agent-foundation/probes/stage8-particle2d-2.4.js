// Paste into Creator 2.4.15 Web preview DevTools after Hello World is running.
// Four memory-only emitters: zero/live particles x autoRemoveOnFinish false/true.
(async function () {
    const scene = cc.director.getScene();
    if (!scene || !cc.ParticleSystem || !window.HTMLCanvasElement) {
        console.error('STAGE8_PARTICLE2D_24_ERROR', 'Scene, ParticleSystem or DOM canvas unavailable');
        return;
    }
    const pausedBefore = cc.game.isPaused();
    const nodes = [];
    const cases = [];
    const samples = [];
    const events = [];
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const capture = async phase => {
        if (!window.__stage8CaptureEnabled) return;
        cc.game.pause(); // Freeze the last rendered frame while the external screenshot is taken.
        await Promise.race([
            new Promise(resolve => {
                window.__stage8CaptureResolve = resolve;
                console.log('STAGE8_PARTICLE2D_24_MARK', phase);
            }),
            delay(2000),
        ]);
        cc.game.resume();
    };
    let frame;
    let texture;
    let parent;
    let ownParent = false;
    const valid = (node, strict) => cc.isValid(node, strict);
    const snap = phase => samples.push({
        phase, frame: cc.director.getTotalFrames(), at: Date.now(),
        cases: cases.map(item => {
            const live = valid(item.node, true);
            const ps = item.ps;
            return {
                name: item.name, live, validDefault: valid(item.node),
                count: live ? ps.particleCount : null,
                stopped: live ? ps.stopped : null,
                active: live ? ps.active : null,
                finished: live ? ps._simulator.finished : null,
                renderFlag: live ? item.node._renderFlag : null,
                assembler: live ? Boolean(ps._assembler) : null,
            };
        }),
    });
    try {
        parent = scene.getChildByName('Canvas');
        if (!parent) {
            parent = new cc.Node('stage8-particle2d-canvas');
            scene.addChild(parent);
            parent.addComponent(cc.Canvas);
            ownParent = true;
        }
        const image = document.createElement('canvas');
        image.width = image.height = 8;
        const ctx = image.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 8, 8);
        texture = new cc.Texture2D();
        texture.initWithElement(image);
        frame = new cc.SpriteFrame(texture);
        for (const countMode of ['zero', 'live']) {
            for (const autoRemove of [false, true]) {
                const node = new cc.Node(`stage8-2d-${countMode}-${autoRemove ? 'remove' : 'keep'}`);
                nodes.push(node);
                node.active = false;
                parent.addChild(node);
                node.setPosition(countMode === 'zero' ? -80 : 80, autoRemove ? 50 : -50);
                const ps = node.addComponent(cc.ParticleSystem);
                ps.playOnLoad = false;
                ps.custom = true;
                ps.spriteFrame = frame;
                ps.autoRemoveOnFinish = autoRemove;
                ps.totalParticles = 80;
                ps.duration = -1;
                ps.emissionRate = countMode === 'zero' ? 0 : 80;
                ps.life = 0.35;
                ps.lifeVar = 0;
                ps.startSize = ps.endSize = 16;
                ps.startColor = cc.color(255, 255, 255, 255);
                ps.endColor = cc.color(255, 255, 255, 255);
                ps.speed = ps.speedVar = 0;
                const name = node.name;
                const finishedSimulation = ps._finishedSimulation;
                ps._finishedSimulation = function () {
                    events.push({ name, kind: 'finishedSimulation', frame: cc.director.getTotalFrames(), at: Date.now(), count: ps.particleCount });
                    return finishedSimulation.apply(this, arguments);
                };
                const destroy = node.destroy;
                node.destroy = function () {
                    const result = destroy.apply(this, arguments);
                    events.push({ name, kind: 'destroyCall', frame: cc.director.getTotalFrames(), at: Date.now(),
                        count: ps.particleCount, validDefault: valid(node), validStrict: valid(node, true) });
                    return result;
                };
                const onDestroy = ps.onDestroy;
                ps.onDestroy = function () {
                    events.push({ name, kind: 'onDestroy', frame: cc.director.getTotalFrames(), at: Date.now() });
                    return onDestroy.apply(this, arguments);
                };
                cases.push({ name, node, ps });
                node.active = true;
                ps.resetSystem();
            }
        }
        if (pausedBefore) cc.game.resume();
        snap('start');
        await delay(200);
        snap('before-stop');
        await capture('before-stop');
        cases.forEach(item => item.ps.stopSystem());
        snap('stop-immediate');
        await delay(100);
        snap('after-100ms');
        await capture('after-100ms');
        await delay(500);
        snap('after-600ms');
        await delay(100);
        snap('after-700ms');
        console.log('STAGE8_PARTICLE2D_24', JSON.stringify({
            version: '2.4.15', creatorVersion: '2.4.15',
            environment: 'Creator Web preview / Chrome DevTools', scene: scene.name,
            probe: 'stage8-particle2d-2.4', pausedBefore,
            texture: 'temporary 8x8 white canvas', clock: 'natural Director frames',
            samples, events,
        }));
    } catch (error) {
        console.error('STAGE8_PARTICLE2D_24_ERROR', error, JSON.stringify({ samples, events }));
    } finally {
        nodes.forEach(node => { if (valid(node, true)) node.destroy(); });
        if (ownParent && valid(parent, true)) parent.destroy();
        await delay(70); // Allow deferred node destruction before releasing temporary assets.
        if (frame) frame.destroy();
        if (texture) texture.destroy();
        if (pausedBefore) cc.game.pause();
    }
})();
