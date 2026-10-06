// Paste into the Creator 3.8.7 Web preview DevTools console.
// Director.tick() is stepped with fixed dt to avoid background-tab RAF pauses.
(() => {
    const wasPaused = cc.game.isPaused();
    const scene = cc.director.getScene();
    const animationManager = cc.director.getSystem('animation');
    const tweenSystem = cc.director.getSystem('TWEEN');
    if (!scene || !animationManager || !tweenSystem) {
        console.error('STAGE8_TWEEN_38_ERROR', 'Scene or manager unavailable');
        return;
    }
    const node = new cc.Node('stage8-tween-probe');
    scene.addChild(node);
    const object = { x: 0 };
    const stoppedObject = { x: 0 };
    const animationUpdate = animationManager.update;
    const tweenUpdate = tweenSystem.update;
    const events = [];
    const order = [];
    const samples = [];
    const completions = [];
    let step = -1;
    let stoppedTween;
    let nodeTween;
    const sample = (phase) => {
        if (step < 8) {
            events.push([phase, step, object.x, node.position.x]);
        }
    };

    cc.game.pause();
    try {
        animationManager.update = function (dt) {
            if (step < 2) order.push('animation');
            animationUpdate.call(this, dt);
            sample('animation-after');
        };
        tweenSystem.update = function (dt) {
            if (step < 2) order.push('tween');
            sample('tween-before');
            tweenUpdate.call(this, dt);
            sample('tween-after');
        };

        cc.tween(object).to(0.25, { x: 100 })
            .call(() => { events.push(['object-complete', step, object.x]); completions.push(['object', step, object.x]); }).start();
        nodeTween = cc.tween(node).to(0.25, { position: new cc.Vec3(100, 0, 0) })
            .call(() => { events.push(['node-complete', step, node.position.x]); completions.push(['node', step, node.position.x]); }).start();
        stoppedTween = cc.tween(stoppedObject).to(0.5, { x: 100 }).start();

        for (step = 0; step < 20; step++) {
            cc.director.tick(0.05);
            if ([0, 1, 2, 3, 4, 5, 6, 8, 10, 19].includes(step)) {
                samples.push([step, object.x, node.position.x, stoppedObject.x]);
            }
            if (step === 1) {
                nodeTween.pause();
                events.push(['node-tween-pause', step, node.position.x]);
            }
            if (step === 3) {
                stoppedTween.stop();
                events.push(['stop', step, stoppedObject.x]);
                nodeTween.resume();
                events.push(['node-tween-resume', step, node.position.x]);
            }
        }
        console.log('STAGE8_TWEEN_38_COMPACT', JSON.stringify({
            clock: 'manual Director.tick(0.05) x20',
            order,
            samples,
            completions,
            final: [object.x, node.position.x, stoppedObject.x],
        }));
        console.log('STAGE8_TWEEN_38', JSON.stringify({
            clock: 'manual Director.tick(0.05) x20',
            final: { object: object.x, nodeX: node.position.x, stopped: stoppedObject.x },
            events,
        }));
    } catch (error) {
        console.error('STAGE8_TWEEN_38_ERROR', error);
    } finally {
        animationManager.update = animationUpdate;
        tweenSystem.update = tweenUpdate;
        stoppedTween && stoppedTween.stop();
        nodeTween && nodeTween.stop();
        node.destroy();
        if (!wasPaused) cc.game.resume();
    }
})();
