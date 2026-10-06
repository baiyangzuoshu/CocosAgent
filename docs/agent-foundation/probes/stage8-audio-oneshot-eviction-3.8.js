// Creator 3.8.7 Web preview, main.scene. Run with creator-audio-headless-probe.mjs.
// Backend start/stop evidence only; the harness bypasses Chrome's gesture policy.
(async function () {
    var api = await System.import('cc');
    var scene = api.director.getScene();
    var marks = [];
    var startedAt = performance.now();
    var nodes = [];
    var sources = [];
    var originalStart, originalStop;
    var clipA, clipB;
    var delay = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
    var mark = function (phase, extra) {
        marks.push(Object.assign({ phase: phase, ms: Math.round(performance.now() - startedAt),
            frame: api.director.getTotalFrames() }, extra || {}));
    };
    var waitFor = async function (predicate, label) {
        for (var i = 0; i < 100; i++) {
            if (predicate()) return;
            await delay(20);
        }
        throw new Error('timed out waiting for ' + label);
    };
    var load = function (path) {
        return new Promise(function (resolve, reject) {
            api.resources.load(path, api.AudioClip, function (error, value) { error ? reject(error) : resolve(value); });
        });
    };
    try {
        if (!window.AudioBufferSourceNode) throw new Error('WebAudio unavailable');
        if (api.AudioSource.maxAudioChannel !== 24) throw new Error('expected Web channel limit 24');
        clipA = await load('stage8-tone-a');
        clipB = await load('stage8-tone-b');
        if (clipA.loadMode !== 1 || clipB.loadMode !== 1) throw new Error('expected WebAudio clips');
        mark('loaded', { limit: api.AudioSource.maxAudioChannel, clipA: clipA._uuid,
            clipB: clipB._uuid, durationA: clipA.getDuration(), durationB: clipB.getDuration() });

        originalStart = AudioBufferSourceNode.prototype.start;
        originalStop = AudioBufferSourceNode.prototype.stop;
        AudioBufferSourceNode.prototype.start = function () {
            var id = sources.length + 1;
            sources.push(this);
            mark('backend:start', { id: id });
            this.addEventListener('ended', function () { mark('backend:ended', { id: id }); });
            return originalStart.apply(this, arguments);
        };
        AudioBufferSourceNode.prototype.stop = function () {
            mark('backend:stop-call', { id: sources.indexOf(this) + 1 });
            return originalStop.apply(this, arguments);
        };

        var root = new api.Node('stage8-audio-eviction-38');
        root.active = false;
        scene.addChild(root);
        nodes.push(root);
        var normal = [];
        for (var n = 0; n < 24; n++) {
            var normalNode = new api.Node('normal-' + n);
            root.addChild(normalNode);
            var ordinary = normalNode.addComponent(api.AudioSource);
            ordinary.playOnAwake = false;
            ordinary.volume = 0.005;
            ordinary.clip = clipA;
            normal.push(ordinary);
        }
        var shotNode = new api.Node('one-shot');
        root.addChild(shotNode);
        var shotSource = shotNode.addComponent(api.AudioSource);
        shotSource.playOnAwake = false;
        shotSource.volume = 0.005;
        await waitFor(function () { return normal.every(function (x) { return x._isLoaded; }); }, '24 ordinary players to load');
        root.active = true;

        for (var j = 0; j < 23; j++) normal[j].play();
        await waitFor(function () { return sources.length >= 23; }, '23 ordinary backend starts');
        mark('23-normal', { playing: normal.slice(0, 23).filter(function (x) { return x.playing; }).length });
        shotSource.playOneShot(clipB, 1);
        await waitFor(function () { return sources.length >= 24; }, 'one-shot backend start');
        var oneShotId = sources.length;
        mark('23-normal-plus-one-shot', { oneShotId: oneShotId, stops: marks.filter(function (x) { return x.phase === 'backend:stop-call'; }).map(function (x) { return x.id; }) });
        normal[23].play();
        await waitFor(function () { return sources.length >= 25; }, '24th ordinary backend start');
        await delay(100);
        mark('add-24th-normal', { oneShotId: oneShotId, oneShotStopCalls: marks.filter(function (x) { return x.phase === 'backend:stop-call' && x.id === oneShotId; }).length,
            playingNormal: normal.filter(function (x) { return x.playing; }).length });

        normal.forEach(function (x) { x.stop(); });
        await delay(80);
        mark('cleanup', { oneShotStopCalls: marks.filter(function (x) { return x.phase === 'backend:stop-call' && x.id === oneShotId; }).length });
        console.log('STAGE8_AUDIO_LIFECYCLE_38', JSON.stringify({ version: '3.8.7', branch: 'one-shot-WebAudio-eviction', marks: marks }));
    } catch (error) {
        console.error('STAGE8_AUDIO_LIFECYCLE_38_ERROR', String(error), JSON.stringify(marks));
    } finally {
        if (originalStart) AudioBufferSourceNode.prototype.start = originalStart;
        if (originalStop) AudioBufferSourceNode.prototype.stop = originalStop;
        nodes.forEach(function (node) { if (api.isValid(node)) node.destroy(); });
    }
})();
