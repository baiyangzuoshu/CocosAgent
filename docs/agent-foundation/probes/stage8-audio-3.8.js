// Paste into the Creator 3.8.7 Web preview DevTools console.
// The two imported resources/stage8-tone-*.wav files must have Creator-generated .meta files.
// Click the temporary button in the preview to satisfy browser audio gesture rules.
(async () => {
    let api;
    try {
        api = await System.import('cc');
    } catch (error) {
        console.error('STAGE8_AUDIO_38_ERROR', 'Could not import cc module', error);
        return;
    }
    const { AudioClip, AudioSource, Node, director, resources } = api;
    const scene = director.getScene();
    if (!scene || !AudioClip || !AudioSource || !resources) {
        console.error('STAGE8_AUDIO_38_ERROR', '3.8 scene or audio APIs unavailable');
        return;
    }
    const load = (path) => new Promise((resolve, reject) => {
        resources.load(path, AudioClip, (error, clip) => error ? reject(error) : resolve(clip));
    });
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const log = (value) => console.log('STAGE8_AUDIO_38', JSON.stringify(value));
    let clipA;
    let clipB;
    try {
        [clipA, clipB] = await Promise.all([load('stage8-tone-a'), load('stage8-tone-b')]);
    } catch (error) {
        console.error('STAGE8_AUDIO_38_ERROR', 'AudioClip import/load failed', error);
        return;
    }

    const root = new Node('stage8-audio-probe');
    root.active = false;
    scene.addChild(root);
    const sources = [];
    const events = [];
    for (let i = 0; i < 24; i++) {
        const node = new Node('stage8-audio-normal-' + i);
        root.addChild(node);
        const source = node.addComponent(AudioSource);
        source.playOnAwake = false;
        source.volume = 0.005;
        source.clip = clipA;
        node.on(AudioSource.EventType.STARTED, () => events.push([i, 'started']));
        node.on(AudioSource.EventType.ENDED, () => events.push([i, 'ended']));
        sources.push(source);
    }
    const shotNode = new Node('stage8-audio-one-shot');
    root.addChild(shotNode);
    const shotSource = shotNode.addComponent(AudioSource);
    shotSource.playOnAwake = false;
    shotSource.volume = 0.005;
    // Prepare normal players before offering the gesture button; otherwise an
    // async wait inside the click handler may lose the browser's user activation.
    for (let attempt = 0; attempt < 50 && sources.some((source) => !source._isLoaded); attempt++) {
        await delay(50);
    }
    if (sources.some((source) => !source._isLoaded)) {
        root.destroy();
        console.error('STAGE8_AUDIO_38_ERROR', 'Ordinary AudioSource player load timed out');
        return;
    }
    root.active = true;
    const button = document.createElement('button');
    button.textContent = 'Run 3.8 audio probe';
    button.style.cssText = 'position:fixed;z-index:99999;top:12px;right:12px;padding:8px';
    document.body.appendChild(button);
    const states = () => sources.map((source, index) => [index, source.state, source.playing]);
    const stopNormal = () => sources.forEach((source) => source.stop());
    button.onclick = async () => {
        button.disabled = true;
        try {
            if (document.hidden || cc.game.isPaused()) {
                throw new Error('Preview must be visible and game running before audio measurement');
            }
            const limit = AudioSource.maxAudioChannel;
            if (limit !== 24) {
                throw new Error('This Web probe expects 24 channels; reported ' + limit);
            }
            log({ phase: 'environment', visibility: document.visibilityState,
                gamePaused: cc.game.isPaused(), limit });
            sources.forEach((source) => source.play());
            shotSource.playOneShot(clipB, 1);
            await delay(700);
            log({ phase: '24-normal-then-one-shot', limit, states: states(), events: events.splice(0) });
            stopNormal();
            // One-shot has no public stop handle; let the three-second test clip finish.
            await delay(3200);

            sources.slice(0, 23).forEach((source) => source.play());
            shotSource.playOneShot(clipB, 1);
            await delay(700);
            log({ phase: '23-normal-plus-one-shot', states: states(), events: events.splice(0) });
            sources[23].play();
            await delay(150);
            log({ phase: 'add-24th-normal', states: states(), events: events.splice(0),
                note: 'One-shot has no public state; compare normal player states and audible result.' });
        } catch (error) {
            console.error('STAGE8_AUDIO_38_ERROR', error);
        } finally {
            stopNormal();
            // A still-playing one-shot is independent of this component and may finish afterward.
            root.destroy();
            button.remove();
        }
    };
    log({ phase: 'ready', note: 'Click the temporary button; only temporary nodes are destroyed.' });
})();
