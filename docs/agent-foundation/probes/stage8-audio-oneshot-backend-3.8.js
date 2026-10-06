// Creator 3.8.7 WebAudio-only one-shot lifecycle probe; start from main.scene.
// Observe temporary AudioBufferSourceNode start/stop/ended, not audible output.
(async function () {
    var api = await System.import('cc');
    var scene = api.director.getScene();
    var marks = [];
    var start = performance.now();
    var delay = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
    var originalStart, originalStop, clip, node, source, duration;
    var sources = [];
    function record(phase, extra) {
        marks.push(Object.assign({ phase: phase, ms: Math.round(performance.now() - start),
            frame: api.director.getTotalFrames(), scene: api.director.getScene() && api.director.getScene().name }, extra || {}));
    }
    try {
        if (!window.AudioBufferSourceNode) throw new Error('WebAudio backend unavailable');
        clip = await new Promise(function (resolve, reject) {
            api.resources.load('stage8-tone-a', api.AudioClip, function (err, value) { err ? reject(err) : resolve(value); });
        });
        if (clip.loadMode !== 1) throw new Error('expected WebAudio clip load mode, got ' + clip.loadMode);
        duration = clip.getDuration();
        record('loaded', { uuid: clip._uuid, duration: duration, loadMode: clip.loadMode });
        originalStart = AudioBufferSourceNode.prototype.start;
        originalStop = AudioBufferSourceNode.prototype.stop;
        AudioBufferSourceNode.prototype.start = function () {
            var id = sources.length + 1;
            sources.push(this);
            this.addEventListener('ended', function () { record('backend:ended', { id: id }); });
            record('backend:start', { id: id, bufferDuration: this.buffer && this.buffer.duration });
            return originalStart.apply(this, arguments);
        };
        AudioBufferSourceNode.prototype.stop = function () {
            record('backend:stop-call', { id: sources.indexOf(this) + 1 });
            return originalStop.apply(this, arguments);
        };
        node = new api.Node('stage8-oneshot-backend-38');
        scene.addChild(node);
        source = node.addComponent(api.AudioSource);
        source.playOnAwake = false;
        source.volume = 0.005;
        source.playOneShot(clip, 1);
        for (var i = 0; i < 40 && sources.length === 0; i++) await delay(50);
        if (!sources.length) throw new Error('one-shot backend did not start');
        record('before-switch', { sourceNodeValid: api.isValid(node), clipCached: api.assetManager.assets.get(clip._uuid) === clip });
        await new Promise(function (resolve, reject) {
            api.director.loadScene('stage4-empty', function (error) {
                if (error) reject(error);
                else { record('switch-callback', { sourceNodeValid: api.isValid(node), startedSources: sources.length }); resolve(); }
            });
        });
        api.assetManager.releaseAsset(clip);
        record('release-after-switch', { clipCached: api.assetManager.assets.get(clip._uuid) === clip,
            clipValid: api.isValid(clip), startedSources: sources.length });
        await delay(Math.ceil(duration * 1000) + 500);
        record('after-duration', { clipValid: api.isValid(clip), startedSources: sources.length,
            stopCalls: marks.filter(function (m) { return m.phase === 'backend:stop-call'; }).length,
            endedEvents: marks.filter(function (m) { return m.phase === 'backend:ended'; }).length });
        console.log('STAGE8_AUDIO_LIFECYCLE_38', JSON.stringify({ version: '3.8.7', branch: 'one-shot-WebAudio-scene-and-release', marks: marks }));
    } catch (error) {
        console.error('STAGE8_AUDIO_LIFECYCLE_38_ERROR', String(error), JSON.stringify(marks));
    } finally {
        if (originalStart) AudioBufferSourceNode.prototype.start = originalStart;
        if (originalStop) AudioBufferSourceNode.prototype.stop = originalStop;
        if (node && api.isValid(node)) node.destroy();
    }
})();
