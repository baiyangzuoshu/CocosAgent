// Paste into the Creator 2.4.15 Web preview DevTools console.
// The two imported resources/stage8-tone-*.wav files must have Creator-generated .meta files.
// Click the temporary button in the preview to satisfy browser audio gesture rules.
(() => {
    if (!cc.resources || !cc.audioEngine || !cc.AudioClip) {
        console.error('STAGE8_AUDIO_24_ERROR', '2.4 audio APIs unavailable');
        return;
    }
    const load = (path) => new Promise((resolve, reject) => {
        cc.resources.load(path, cc.AudioClip, (error, clip) => error ? reject(error) : resolve(clip));
    });
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const engine = cc.audioEngine;
    const log = (value) => console.log('STAGE8_AUDIO_24', JSON.stringify(value));
    Promise.all([load('stage8-tone-a'), load('stage8-tone-b')]).then(async ([clipA, clipB]) => {
        const button = document.createElement('button');
        button.textContent = 'Run 2.4 audio probe';
        button.style.cssText = 'position:fixed;z-index:99999;top:12px;right:12px;padding:8px';
        document.body.appendChild(button);
        button.onclick = async () => {
            button.disabled = true;
            const allIds = [];
            const states = (ids) => ids.map((id) => [id, engine.getState(id), Boolean(engine._id2audio[id])]);
            const play = (clip, group) => {
                const id = engine.play(clip, false, 0.005);
                allIds.push(id);
                return [group, id];
            };
            const stopOwn = (ids) => ids.forEach((id) => engine.stop(id));
            try {
                if (document.hidden || cc.game.isPaused()) {
                    throw new Error('Preview must be visible and game running before audio measurement');
                }
                log({ phase: 'environment', visibility: document.visibilityState,
                    gamePaused: cc.game.isPaused(), urlA: clipA.nativeUrl, urlB: clipB.nativeUrl,
                    stateColumns: ['id', 'state', 'managedByAudioEngine'] });
                const same = Array.from({ length: 25 }, () => play(clipA, 'a'));
                await delay(120);
                log({ phase: 'same-url-25', maxPerUrl: engine.getMaxAudioInstance(),
                    ids: same, states: states(same.map((entry) => entry[1])) });
                stopOwn(same.map((entry) => entry[1]));
                await delay(150);

                const mixed = [];
                for (let i = 0; i < 13; i++) mixed.push(play(clipA, 'a'));
                for (let i = 0; i < 12; i++) mixed.push(play(clipB, 'b'));
                await delay(120);
                log({ phase: 'mixed-url-25', ids: mixed,
                    states: states(mixed.map((entry) => entry[1])) });
                stopOwn(mixed.map((entry) => entry[1]));
                await delay(150);
                log({ phase: 'after-stop', states: states(allIds) });
            } catch (error) {
                console.error('STAGE8_AUDIO_24_ERROR', error);
            } finally {
                stopOwn(allIds);
                button.remove();
            }
        };
        log({ phase: 'ready', note: 'Click the temporary button; only probe-created IDs are stopped.' });
    }).catch((error) => console.error('STAGE8_AUDIO_24_ERROR', 'AudioClip import/load failed', error));
})();
