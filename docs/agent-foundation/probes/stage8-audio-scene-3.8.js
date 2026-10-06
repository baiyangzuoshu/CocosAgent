// Creator 3.8.7 Web preview; start from main.scene with a fresh page.
// The harness sets window.__stage8AudioAutoRelease for each isolated run.
(async function () {
    var api = await System.import('cc');
    var director = api.director;
    var oldScene = director.getScene();
    var autoRelease = Boolean(window.__stage8AudioAutoRelease);
    var marks = [];
    var start = performance.now();
    var delay = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
    var clip, node, source;
    function record(phase, extra) {
        marks.push(Object.assign({ phase: phase, ms: Math.round(performance.now() - start),
            frame: director.getTotalFrames(), scene: director.getScene() && director.getScene().name }, extra || {}));
    }
    function status() {
        return { oldSceneValid: api.isValid(oldScene), sourceNodeValid: node ? api.isValid(node) : null,
            sourcePlaying: source ? source.playing : null, sourceState: source ? source.state : null,
            sourcePlayerExists: source ? Boolean(source._player) : null,
            sourceClipPresent: source ? Boolean(source.clip) : null,
            clipValid: clip ? api.isValid(clip) : null, clipRefCount: clip && clip.refCount,
            clipCached: clip ? api.assetManager.assets.get(clip._uuid) === clip : null };
    }
    try {
        if (!oldScene) throw new Error('source scene unavailable');
        clip = await new Promise(function (resolve, reject) {
            api.resources.load('stage8-tone-a', api.AudioClip, function (err, value) { err ? reject(err) : resolve(value); });
        });
        var originalClipDestroy = clip.destroy;
        clip.destroy = function () {
            record('clip:destroy-before', status());
            var result = originalClipDestroy.call(this);
            record('clip:destroy-after', status());
            return result;
        };
        node = new api.Node('stage8-audio-scene-38');
        node.active = false;
        oldScene.addChild(node);
        source = node.addComponent(api.AudioSource);
        source.playOnAwake = false;
        source.volume = 0.005;
        source.clip = clip;
        node.on(api.AudioSource.EventType.STARTED, function () { record('source:started', status()); });
        node.on(api.AudioSource.EventType.ENDED, function () { record('source:ended', status()); });
        var oldDisable = source.onDisable;
        source.onDisable = function () { record('source:onDisable-before', status()); oldDisable.call(this); record('source:onDisable-after', status()); };
        var oldDestroy = source.onDestroy;
        source.onDestroy = function () { record('source:onDestroy-before', status()); oldDestroy.call(this); record('source:onDestroy-after', status()); };
        node.active = true;
        oldScene.autoReleaseAssets = autoRelease;
        for (var i = 0; i < 60 && !source._isLoaded; i++) await delay(50);
        source.play();
        await delay(180);
        record('before-switch', Object.assign({ autoRelease: autoRelease,
            clipUuid: clip._uuid, clipDuration: clip.getDuration() }, status()));
        await new Promise(function (resolve, reject) {
            director.loadScene('stage4-empty', function (error) {
                if (error) reject(error);
                else { record('switch-callback', status()); resolve(); }
            });
        });
        await delay(400);
        record('after-switch-400ms', status());
        api.assetManager.releaseAsset(clip);
        record('explicit-release-immediate', status());
        await delay(400);
        record('explicit-release-400ms', status());
        console.log('STAGE8_AUDIO_LIFECYCLE_38', JSON.stringify({ version: '3.8.7', branch: autoRelease ? 'autoRelease=true' : 'autoRelease=false', marks: marks }));
    } catch (error) {
        console.error('STAGE8_AUDIO_LIFECYCLE_38_ERROR', String(error), JSON.stringify(marks));
    }
})();
