// Paste into the Creator 2.4.15 Web preview DevTools console.
// This creates only a temporary Node and Clip. It does not edit the scene asset.
(() => {
    const scene = cc.director.getScene();
    const actionManager = cc.director.getActionManager();
    const animationManager = cc.director.getAnimationManager();
    if (!scene || !actionManager || !animationManager) {
        console.error('STAGE8_CLIP_24_ERROR', 'Scene or manager unavailable');
        return;
    }

    const wasPaused = cc.game.isPaused();
    const node = new cc.Node('stage8-clip-probe');
    scene.addChild(node);
    const events = [];
    let phase = 'clip-only';
    let step = -1;
    const FrameReceiver = cc.Class({
        extends: cc.Component,
        onStage8Frame(arg) { events.push([phase, step, 'frame', arg, node.x]); },
    });
    node.addComponent(FrameReceiver);
    const clip = new cc.AnimationClip();
    clip.name = 'stage8-position-x';
    clip._duration = 0.25; // duration is a read-only getter in 2.4.15.
    clip.curveData = { props: { x: [
        { frame: 0, value: 0 },
        { frame: 0.25, value: 100 },
    ] } };
    clip.events = [{ frame: 0.1, func: 'onStage8Frame', params: ['event-arg'] }];
    const animation = node.addComponent(cc.Animation);
    animation.addClip(clip);
    const samples = [];
    const order = [];
    let tween;
    const actionUpdate = actionManager.update;
    const animationUpdate = animationManager.update;
    for (const type of ['play', 'stop', 'finished']) {
        animation.on(type, (name, state) => events.push([phase, step, type, name, state && state.time, node.x]));
    }

    cc.game.pause();
    try {
        actionManager.update = function (dt) {
            if (step < 2) order.push([phase, step, 'action', node.x]);
            actionUpdate.call(this, dt);
            if (step < 2) order.push([phase, step, 'action-after', node.x]);
        };
        animationManager.update = function (dt) {
            if (step < 2) order.push([phase, step, 'animation', node.x]);
            animationUpdate.call(this, dt);
            if (step < 2) order.push([phase, step, 'animation-after', node.x]);
        };

        for (const run of ['clip-only', 'clip-plus-tween']) {
            phase = run;
            node.x = 0;
            animation.play(clip.name);
            if (run === 'clip-plus-tween') {
                tween = cc.tween(node).to(0.25, { x: 200 }).start();
            }
            for (step = 0; step < 8; step++) {
                cc.director._scheduler.update(0.05);
                samples.push([phase, step, node.x]);
            }
            animation.stop();
            if (tween) { tween.stop(); tween = null; }
        }
        console.log('STAGE8_CLIP_24', JSON.stringify({
            clock: 'manual Scheduler.update(0.05), 8 steps per phase',
            clip: { duration: clip.duration, curve: 'Node.x: 0 -> 100' },
            tween: 'Node.x: 0 -> 200', order, samples, events,
        }));
    } catch (error) {
        console.error('STAGE8_CLIP_24_ERROR', error);
    } finally {
        actionManager.update = actionUpdate;
        animationManager.update = animationUpdate;
        if (tween) tween.stop();
        animation.stop();
        node.destroy();
        if (!wasPaused) cc.game.resume();
    }
})();
