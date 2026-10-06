// Paste into the Creator 3.8.7 Web preview DevTools console.
// This creates only a temporary Node and Clip. It does not edit the scene asset.
(async () => {
    const scene = cc.director.getScene();
    const animationManager = cc.director.getSystem('animation');
    const tweenSystem = cc.director.getSystem('TWEEN');
    // The preview's legacy global `cc` does not expose `cc.animation.VectorTrack`.
    // Use the official `cc` module, which the Creator preview loads through SystemJS.
    let VectorTrack;
    try {
        const ccModule = await System.import('cc');
        VectorTrack = ccModule.animation && ccModule.animation.VectorTrack;
    } catch (error) {
        console.error('STAGE8_CLIP_38_ERROR', 'Could not import cc module', error);
        return;
    }
    if (!scene || !animationManager || !tweenSystem || !VectorTrack) {
        console.error('STAGE8_CLIP_38_ERROR', 'Scene, manager, or cc.animation.VectorTrack export unavailable');
        return;
    }

    const wasPaused = cc.game.isPaused();
    const node = new cc.Node('stage8-clip-probe');
    scene.addChild(node);
    const events = [];
    let phase = 'clip-only';
    let step = -1;
    class FrameReceiver extends cc.Component {
        onStage8Frame(arg) { events.push([phase, step, 'frame', arg, node.position.x]); }
    }
    node.addComponent(FrameReceiver);
    const clip = new cc.AnimationClip();
    clip.name = 'stage8-position-x';
    clip.duration = 0.25;
    const track = new VectorTrack();
    track.componentsCount = 3;
    track.path.toProperty('position');
    track.channels()[0].curve.assignSorted([
        [0, { value: 0 }],
        [0.25, { value: 100 }],
    ]);
    clip.addTrack(track);
    clip.events = [{ frame: 0.1, func: 'onStage8Frame', params: ['event-arg'] }];
    const animation = node.addComponent(cc.Animation);
    animation.clips = [clip];
    const samples = [];
    const order = [];
    let tween;
    const animationUpdate = animationManager.update;
    const tweenUpdate = tweenSystem.update;
    for (const type of ['play', 'stop', 'finished']) {
        animation.on(type, (name, state) => events.push([phase, step, type, name, state && state.time, node.position.x]));
    }

    cc.game.pause();
    try {
        animationManager.update = function (dt) {
            if (step < 2) order.push([phase, step, 'animation', node.position.x]);
            animationUpdate.call(this, dt);
            if (step < 2) order.push([phase, step, 'animation-after', node.position.x]);
        };
        tweenSystem.update = function (dt) {
            if (step < 2) order.push([phase, step, 'tween', node.position.x]);
            tweenUpdate.call(this, dt);
            if (step < 2) order.push([phase, step, 'tween-after', node.position.x]);
        };

        for (const run of ['clip-only', 'clip-plus-tween']) {
            phase = run;
            node.setPosition(0, 0, 0);
            animation.play(clip.name);
            if (run === 'clip-plus-tween') {
                tween = cc.tween(node).to(0.25, { position: new cc.Vec3(200, 0, 0) }).start();
            }
            for (step = 0; step < 8; step++) {
                cc.director.tick(0.05);
                samples.push([phase, step, node.position.x]);
            }
            animation.stop();
            if (tween) { tween.stop(); tween = null; }
        }
        console.log('STAGE8_CLIP_38', JSON.stringify({
            clock: 'manual Director.tick(0.05), 8 steps per phase',
            clip: { duration: clip.duration, curve: 'Node.position.x: 0 -> 100' },
            tween: 'Node.position: (0,0,0) -> (200,0,0)', order, samples, events,
        }));
    } catch (error) {
        console.error('STAGE8_CLIP_38_ERROR', error);
    } finally {
        animationManager.update = animationUpdate;
        tweenSystem.update = tweenUpdate;
        if (tween) tween.stop();
        animation.stop();
        node.destroy();
        if (!wasPaused) cc.game.resume();
    }
})();
