// Creator 2.4.15 Web preview; start from helloworld.fire with a fresh page.
// The harness sets window.__stage8AudioAutoRelease for each isolated run.
(async function () {
    var director = cc.director;
    var oldScene = director.getScene();
    var autoRelease = Boolean(window.__stage8AudioAutoRelease);
    var marks = [];
    var start = performance.now();
    var delay = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
    var clip, node, source, id;
    function record(phase, extra) {
        marks.push(Object.assign({ phase: phase, ms: Math.round(performance.now() - start),
            frame: director._totalFrames, scene: director.getScene() && director.getScene().name }, extra || {}));
    }
    function status() {
        return { oldSceneValid: cc.isValid(oldScene), sourceNodeValid: node ? cc.isValid(node) : null,
            sourceAudioState: source && source.audio ? source.audio.getState() : null,
            globalId: id, globalState: id ? cc.audioEngine.getState(id) : null,
            globalManaged: id ? Boolean(cc.audioEngine._id2audio[id]) : null,
            clipValid: clip ? cc.isValid(clip) : null, clipRefCount: clip && clip.refCount,
            clipCached: clip ? cc.assetManager.assets.get(clip._uuid) === clip : null };
    }
    try {
        if (!oldScene || oldScene.name !== 'helloworld') throw new Error('expected helloworld source scene');
        clip = await new Promise(function (resolve, reject) {
            cc.resources.load('stage8-tone-a', cc.AudioClip, function (err, value) { err ? reject(err) : resolve(value); });
        });
        var originalClipDestroy = clip.destroy;
        clip.destroy = function () {
            record('clip:destroy-before', status());
            var result = originalClipDestroy.call(this);
            record('clip:destroy-after', status());
            return result;
        };
        node = new cc.Node('stage8-audio-scene-24');
        node.active = false;
        oldScene.addChild(node);
        source = node.addComponent(cc.AudioSource);
        source.playOnLoad = false;
        source.volume = 0.005;
        source.clip = clip;
        var oldDisable = source.onDisable;
        source.onDisable = function () { record('source:onDisable-before', status()); oldDisable.call(this); record('source:onDisable-after', status()); };
        var oldDestroy = source.onDestroy;
        source.onDestroy = function () { record('source:onDestroy-before', status()); oldDestroy.call(this); record('source:onDestroy-after', status()); };
        node.active = true;
        oldScene.autoReleaseAssets = autoRelease;
        source.play();
        id = cc.audioEngine.play(clip, false, 0.005);
        await delay(180);
        record('before-switch', Object.assign({ autoRelease: autoRelease,
            clipUuid: clip._uuid, clipDuration: clip.duration }, status()));
        await new Promise(function (resolve, reject) {
            director.loadScene('stage4-empty', function (error) {
                if (error) reject(error);
                else { record('switch-callback', status()); resolve(); }
            });
        });
        await delay(400);
        record('after-switch-400ms', status());
        cc.assetManager.releaseAsset(clip);
        record('explicit-release-immediate', status());
        await delay(400);
        record('explicit-release-400ms', status());
        console.log('STAGE8_AUDIO_LIFECYCLE_24', JSON.stringify({ version: '2.4.15', branch: autoRelease ? 'autoRelease=true' : 'autoRelease=false', marks: marks }));
    } catch (error) {
        console.error('STAGE8_AUDIO_LIFECYCLE_24_ERROR', String(error), JSON.stringify(marks));
    } finally {
        if (id && cc.audioEngine.getState(id) !== -1) cc.audioEngine.stop(id);
    }
})();
