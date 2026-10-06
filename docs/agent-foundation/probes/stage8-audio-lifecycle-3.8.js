// Creator 3.8.7 Web preview, run with creator-audio-headless-probe.mjs.
// Temporary nodes only; Chrome autoplay policy is relaxed by the harness.
(async function () {
    var api = await System.import('cc');
    var scene = api.director.getScene();
    var marks = [];
    var nodes = [];
    var start = performance.now();
    var delay = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
    function record(phase, extra) {
        marks.push(Object.assign({ phase: phase, ms: Math.round(performance.now() - start),
            frame: api.director.getTotalFrames(), scene: api.director.getScene() && api.director.getScene().name }, extra || {}));
    }
    function state(source) {
        return { playing: source.playing, audioState: source.state, currentTime: source.currentTime,
            loaded: source._isLoaded, playerExists: Boolean(source._player),
            nodeValid: api.isValid(source.node), clipValid: Boolean(source.clip && api.isValid(source.clip)) };
    }
    function create(clip, name) {
        var node = new api.Node(name);
        node.active = false;
        scene.addChild(node);
        var source = node.addComponent(api.AudioSource);
        source.playOnAwake = false;
        source.volume = 0.005;
        source.clip = clip;
        node.on(api.AudioSource.EventType.STARTED, function () { record(name + ':started', state(source)); });
        node.on(api.AudioSource.EventType.ENDED, function () { record(name + ':ended', state(source)); });
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
            api.resources.load('stage8-tone-a', api.AudioClip, function (err, value) { err ? reject(err) : resolve(value); });
        });
        var duration = clip.getDuration();
        record('loaded', { duration: duration, uuid: clip._uuid, refCount: clip.refCount,
            cached: api.assetManager.assets.get(clip._uuid) === clip, loadMode: clip.loadMode });

        var natural = create(clip, 'stage8-audio-natural-38');
        for (var i = 0; i < 60 && !natural._isLoaded; i++) await delay(50);
        natural.play();
        record('natural:play', state(natural));
        await delay(150);
        record('natural:150ms', state(natural));
        await delay(Math.ceil(duration * 1000) + 300);
        record('natural:after-duration', state(natural));
        natural.node.destroy();
        await delay(80);

        var disable = create(clip, 'stage8-audio-disable-38');
        for (var j = 0; j < 60 && !disable._isLoaded; j++) await delay(50);
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

        var doomed = create(clip, 'stage8-audio-destroy-38');
        for (var k = 0; k < 60 && !doomed._isLoaded; k++) await delay(50);
        doomed.play();
        await delay(150);
        record('destroy:before', state(doomed));
        doomed.node.destroy();
        record('destroy:immediate', state(doomed));
        await delay(100);
        record('destroy:later', Object.assign({ refCount: clip.refCount }, state(doomed)));
        record('end', { marks: marks.length });
        console.log('STAGE8_AUDIO_LIFECYCLE_38', JSON.stringify({ version: '3.8.7', marks: marks }));
    } catch (error) {
        console.error('STAGE8_AUDIO_LIFECYCLE_38_ERROR', String(error), JSON.stringify(marks));
    } finally {
        nodes.forEach(function (node) { if (api.isValid(node)) node.destroy(); });
    }
})();
