// Creator 2.4.15 Web preview, fresh helloworld page; run keep/release in separate pages.
// This fixture serializes AudioSource._clip in stage8-audio-static.fire.
(async function () {
    var director = cc.director;
    var autoRelease = Boolean(window.__stage8AudioAutoRelease);
    var marks = [];
    var begin = performance.now();
    var scene, source, clip, id;
    function status() {
        return {
            scene: director.getScene() && director.getScene().name,
            sceneValid: scene ? cc.isValid(scene, true) : null,
            sourceValid: source ? cc.isValid(source, true) : null,
            clipUuid: clip ? clip._uuid : null,
            clipValid: clip ? cc.isValid(clip, true) : null,
            clipRefCount: clip ? clip.refCount : null,
            clipCached: clip ? cc.assetManager.assets.get(clip._uuid) === clip : null,
            audioId: id || null,
            audioState: id ? cc.audioEngine.getState(id) : null,
            audioManaged: id ? Boolean(cc.audioEngine._id2audio[id]) : null,
        };
    }
    function record(phase, more) {
        marks.push(Object.assign({ phase: phase, ms: Math.round(performance.now() - begin),
            frame: director._totalFrames }, status(), more || {}));
    }
    function load(name) {
        return new Promise(function (resolve, reject) {
            director.loadScene(name, function (error) { error ? reject(error) : resolve(); });
        });
    }
    try {
        await load('stage8-audio-static');
        scene = director.getScene();
        source = scene.getChildByName('Canvas').getComponent(cc.AudioSource);
        clip = source && source.clip;
        var deps = cc.assetManager.dependUtil.getDeps(scene._id) || [];
        record('loaded-static-scene', { autoRelease: autoRelease, sceneId: scene._id,
            sourceClipPresent: Boolean(clip), dependencyCount: deps.length,
            clipInSceneDeps: clip ? deps.indexOf(clip._uuid) !== -1 : null,
            expectedClipInSceneDeps: deps.indexOf('72d7c6df-5846-4900-8ec1-7ddd07123ede') !== -1 });
        if (!clip) throw new Error('serialized AudioSource clip did not resolve');
        var oldDestroy = clip.destroy;
        clip.destroy = function () {
            record('clip:destroy-before');
            var result = oldDestroy.call(this);
            record('clip:destroy-after');
            return result;
        };
        scene.autoReleaseAssets = autoRelease;
        id = cc.audioEngine.play(clip, true, 0.005);
        await new Promise(function (resolve) { setTimeout(resolve, 200); });
        record('before-switch');
        await load('stage4-empty');
        record('switch-callback');
        await new Promise(function (resolve) { setTimeout(resolve, 400); });
        record('after-switch-400ms');
        console.log('STAGE8_AUDIO_LIFECYCLE_24_STATIC', JSON.stringify({
            version: '2.4.15', branch: autoRelease ? 'autoRelease=true' : 'autoRelease=false', marks: marks }));
    } catch (error) {
        console.error('STAGE8_AUDIO_LIFECYCLE_24_STATIC_ERROR', String(error), JSON.stringify(marks));
    } finally {
        if (id && cc.audioEngine.getState(id) !== -1) cc.audioEngine.stop(id);
    }
})();
