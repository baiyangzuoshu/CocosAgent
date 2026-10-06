// Creator 2.4.15 Web preview, run with creator-audio-headless-probe.mjs.
// Temporary nodes only; Chrome autoplay policy is relaxed by the harness.
(async function () {
    var scene = cc.director.getScene();
    var marks = [];
    var nodes = [];
    var ids = [];
    var start = performance.now();
    var delay = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
    function record(phase, extra) {
        marks.push(Object.assign({ phase: phase, ms: Math.round(performance.now() - start),
            frame: cc.director._totalFrames, scene: cc.director.getScene() && cc.director.getScene().name }, extra || {}));
    }
    function state(source) {
        return { playing: source.isPlaying, audioState: source.audio.getState(),
            currentTime: source.audio.getCurrentTime(), nodeValid: cc.isValid(source.node),
            clipValid: cc.isValid(source.clip) };
    }
    function create(clip, name) {
        var node = new cc.Node(name);
        node.active = false;
        scene.addChild(node);
        var source = node.addComponent(cc.AudioSource);
        source.playOnLoad = false;
        source.volume = 0.005;
        source.clip = clip;
        source.audio.on('ended', function () { record(name + ':ended', state(source)); });
        source.audio.on('stop', function () { record(name + ':stop', state(source)); });
        var oldDisable = source.onDisable;
        source.onDisable = function () { record(name + ':onDisable-before', state(source)); oldDisable.call(this); record(name + ':onDisable-after', state(source)); };
        var oldDestroy = source.onDestroy;
        source.onDestroy = function () { record(name + ':onDestroy-before', state(source)); oldDestroy.call(this); record(name + ':onDestroy-after', state(source)); };
        node.active = true;
        nodes.push(node);
        return source;
    }
    try {
        var clip = await new Promise(function (resolve, reject) {
            cc.resources.load('stage8-tone-a', cc.AudioClip, function (err, value) { err ? reject(err) : resolve(value); });
        });
        record('loaded', { duration: clip.duration, uuid: clip._uuid, refCount: clip.refCount,
            cached: cc.assetManager.assets.get(clip._uuid) === clip, loadMode: clip.loadMode });

        var natural = create(clip, 'stage8-audio-natural-24');
        natural.play();
        record('natural:play', state(natural));
        await delay(150);
        record('natural:150ms', state(natural));
        await delay(Math.ceil(clip.duration * 1000) + 300);
        record('natural:after-duration', state(natural));
        natural.node.destroy();
        await delay(80);

        var disable = create(clip, 'stage8-audio-disable-24');
        disable.play();
        await delay(150);
        record('disable:before', state(disable));
        disable.node.active = false;
        record('disable:immediate', state(disable));
        disable.node.active = true;
        await delay(100);
        record('disable:reenabled', state(disable));
        disable.node.destroy();
        await delay(80);

        var doomed = create(clip, 'stage8-audio-destroy-24');
        doomed.play();
        var id = cc.audioEngine.play(clip, false, 0.005);
        ids.push(id);
        await delay(150);
        record('destroy:before', Object.assign({ globalId: id, globalState: cc.audioEngine.getState(id) }, state(doomed)));
        doomed.node.destroy();
        record('destroy:immediate', { globalState: cc.audioEngine.getState(id),
            componentAudioState: doomed.audio.getState(), nodeValid: cc.isValid(doomed.node) });
        await delay(100);
        record('destroy:later', { globalState: cc.audioEngine.getState(id),
            componentAudioState: doomed.audio ? doomed.audio.getState() : null, nodeValid: cc.isValid(doomed.node),
            clipValid: cc.isValid(clip), refCount: clip.refCount });
        record('end', { marks: marks.length });
        console.log('STAGE8_AUDIO_LIFECYCLE_24', JSON.stringify({ version: '2.4.15', marks: marks }));
    } catch (error) {
        console.error('STAGE8_AUDIO_LIFECYCLE_24_ERROR', String(error), JSON.stringify(marks));
    } finally {
        ids.forEach(function (id) { cc.audioEngine.stop(id); });
        nodes.forEach(function (node) { if (cc.isValid(node)) node.destroy(); });
    }
})();
