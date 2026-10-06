// Paste into the Creator 2.4.15 Web preview DevTools console.
// Manual Scheduler time is intentional: a hidden preview may pause its RAF loop.
(() => {
    const wasPaused = cc.game.isPaused();
    const scene = cc.director.getScene();
    const actionManager = cc.director.getActionManager();
    const animationManager = cc.director.getAnimationManager();
    if (!scene || !actionManager || !animationManager) {
        console.error('STAGE8_TWEEN_24_ERROR', 'Scene or manager unavailable');
        return;
    }
    const node = new cc.Node('stage8-tween-probe');
    scene.addChild(node);
    const object = { x: 0 };
    const stoppedObject = { x: 0 };
    const actionUpdate = actionManager.update;
    const animationUpdate = animationManager.update;
    const events = [];
    const order = [];
    const samples = [];
    const completions = [];
    let step = -1;
    let stoppedTween;
    const sample = (phase) => {
        if (step < 8) {
            events.push([phase, step, object.x, node.x]);
        }
    };

    cc.game.pause();
    try {
        actionManager.update = function (dt) {
            if (step < 2) order.push('action');
            sample('action-before');
            actionUpdate.call(this, dt);
            sample('action-after');
        };
        animationManager.update = function (dt) {
            if (step < 2) order.push('animation');
            animationUpdate.call(this, dt);
            sample('animation-after');
        };

        cc.tween(object).to(0.25, { x: 100 })
            .call(() => { events.push(['object-complete', step, object.x]); completions.push(['object', step, object.x]); }).start();
        cc.tween(node).to(0.25, { x: 100 })
            .call(() => { events.push(['node-complete', step, node.x]); completions.push(['node', step, node.x]); }).start();
        stoppedTween = cc.tween(stoppedObject).to(0.5, { x: 100 }).start();

        for (step = 0; step < 20; step++) {
            cc.director._scheduler.update(0.05);
            if ([0, 1, 2, 3, 4, 5, 6, 8, 10, 19].includes(step)) {
                samples.push([step, object.x, node.x, stoppedObject.x]);
            }
            if (step === 1) {
                node.pauseAllActions();
                events.push(['node-actions-pause', step, node.x]);
            }
            if (step === 3) {
                stoppedTween.stop();
                events.push(['stop', step, stoppedObject.x]);
                node.resumeAllActions();
                events.push(['node-actions-resume', step, node.x]);
            }
        }
        console.log('STAGE8_TWEEN_24_COMPACT', JSON.stringify({
            clock: 'manual Scheduler.update(0.05) x20',
            order,
            samples,
            completions,
            final: [object.x, node.x, stoppedObject.x],
        }));
        console.log('STAGE8_TWEEN_24', JSON.stringify({
            clock: 'manual Scheduler.update(0.05) x20',
            final: { object: object.x, node: node.x, stopped: stoppedObject.x },
            events,
        }));
    } catch (error) {
        console.error('STAGE8_TWEEN_24_ERROR', error);
    } finally {
        actionManager.update = actionUpdate;
        animationManager.update = animationUpdate;
        stoppedTween && stoppedTween.stop();
        node.destroy();
        if (!wasPaused) cc.game.resume();
    }
})();
