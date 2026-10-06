// Paste into Creator 3.8.7 Web preview DevTools after the 3D sample scene is running.
// Creates a temporary UI Canvas and four memory-only emitters; no scene asset is edited.
(async function () {
    let api;
    try {
        api = await System.import('cc');
    } catch (error) {
        console.error('STAGE8_PARTICLE2D_38_ERROR', 'cc import failed', error);
        return;
    }
    const { Node, Canvas, UITransform, Camera, Size, Layers, SpriteFrame, Color,
        ParticleSystem2D, director, game, isValid } = api;
    const scene = director.getScene();
    if (!scene || !ParticleSystem2D || !window.HTMLCanvasElement) {
        console.error('STAGE8_PARTICLE2D_38_ERROR', 'Scene, ParticleSystem2D or DOM canvas unavailable');
        return;
    }
    const pausedBefore = game.isPaused();
    const nodes = [];
    const cases = [];
    const samples = [];
    const events = [];
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const capture = async phase => {
        if (!window.__stage8CaptureEnabled) return;
        game.pause(); // Freeze the last rendered frame while the external screenshot is taken.
        await Promise.race([
            new Promise(resolve => {
                window.__stage8CaptureResolve = resolve;
                console.log('STAGE8_PARTICLE2D_38_MARK', phase);
            }),
            delay(2000),
        ]);
        game.resume();
    };
    let canvasNode;
    let frame;
    let texture;
    let imageAsset;
    const snap = phase => samples.push({
        phase, frame: director.getTotalFrames(), at: Date.now(),
        cases: cases.map(item => {
            const live = isValid(item.node, true);
            const ps = item.ps;
            return {
                name: item.name, live, validDefault: isValid(item.node),
                count: live ? ps.particleCount : null,
                stopped: live ? ps.stopped : null,
                active: live ? ps.active : null,
                finished: live ? ps._simulator.finished : null,
                renderData: live ? Boolean(ps._simulator.renderData) : null,
                renderFlag: live ? ps._renderFlag : null,
                canRender: live ? ps._canRender() : null,
            };
        }),
    });
    try {
        canvasNode = new Node('stage8-particle2d-canvas');
        canvasNode.active = false;
        canvasNode.layer = Layers.Enum.UI_2D;
        scene.addChild(canvasNode);
        const canvas = canvasNode.addComponent(Canvas);
        canvasNode.addComponent(UITransform).contentSize = new Size(600, 600);
        const cameraNode = new Node('stage8-particle2d-camera');
        cameraNode.layer = Layers.Enum.UI_2D;
        cameraNode.parent = canvasNode;
        const camera = cameraNode.addComponent(Camera);
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        camera.visibility = Layers.Enum.UI_2D;
        canvas.cameraComponent = camera;

        const source = document.createElement('canvas');
        source.width = source.height = 8;
        const ctx = source.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 8, 8);
        frame = SpriteFrame.createWithImage(source);
        texture = frame.texture;
        imageAsset = texture.image;
        for (const countMode of ['zero', 'live']) {
            for (const autoRemove of [false, true]) {
                const node = new Node(`stage8-2d-${countMode}-${autoRemove ? 'remove' : 'keep'}`);
                nodes.push(node);
                node.active = false;
                node.layer = Layers.Enum.UI_2D;
                canvasNode.addChild(node);
                node.setPosition(countMode === 'zero' ? -80 : 80, autoRemove ? 50 : -50);
                const ps = node.addComponent(ParticleSystem2D);
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
                ps.startColor = new Color(255, 255, 255, 255);
                ps.endColor = new Color(255, 255, 255, 255);
                ps.speed = ps.speedVar = 0;
                const name = node.name;
                const finishedSimulation = ps._finishedSimulation;
                ps._finishedSimulation = function () {
                    events.push({ name, kind: 'finishedSimulation', frame: director.getTotalFrames(), at: Date.now(), count: ps.particleCount });
                    return finishedSimulation.apply(this, arguments);
                };
                const destroy = node.destroy;
                node.destroy = function () {
                    const result = destroy.apply(this, arguments);
                    events.push({ name, kind: 'destroyCall', frame: director.getTotalFrames(), at: Date.now(),
                        count: ps.particleCount, validDefault: isValid(node), validStrict: isValid(node, true) });
                    return result;
                };
                const onDestroy = ps.onDestroy;
                ps.onDestroy = function () {
                    events.push({ name, kind: 'onDestroy', frame: director.getTotalFrames(), at: Date.now() });
                    return onDestroy.apply(this, arguments);
                };
                cases.push({ name, node, ps });
            }
        }
        canvasNode.active = true;
        cases.forEach(item => { item.node.active = true; item.ps.resetSystem(); });
        if (pausedBefore) game.resume();
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
        console.log('STAGE8_PARTICLE2D_38', JSON.stringify({
            version: '3.8.7', creatorVersion: '3.8.7',
            environment: 'Creator Web preview / Chrome DevTools', scene: scene.name,
            probe: 'stage8-particle2d-3.8', pausedBefore,
            texture: 'temporary 8x8 white canvas', clock: 'natural Director frames',
            samples, events,
        }));
    } catch (error) {
        console.error('STAGE8_PARTICLE2D_38_ERROR', error, JSON.stringify({ samples, events }));
    } finally {
        if (canvasNode && isValid(canvasNode, true)) canvasNode.destroy();
        await delay(70); // Allow deferred node destruction before releasing temporary assets.
        if (frame) frame.destroy();
        if (texture) texture.destroy();
        if (imageAsset) imageAsset.destroy();
        if (pausedBefore) game.pause();
    }
})();
