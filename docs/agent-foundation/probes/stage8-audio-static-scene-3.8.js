// Creator 3.8.7 Web preview, fresh main page; run keep/release in separate pages.
// This fixture serializes AudioSource._clip in stage8-audio-static.scene.
(async function () {
    var api = await System.import('cc');
    var director = api.director;
    var autoRelease = Boolean(window.__stage8AudioAutoRelease);
    var marks = [];
    var begin = performance.now();
    var scene, source, clip;
    function status() {
        return {
            scene: director.getScene() && director.getScene().name,
            sceneValid: scene ? api.isValid(scene, true) : null,
            sourceValid: source ? api.isValid(source, true) : null,
            sourceState: source ? source.state : null,
            sourcePlaying: source ? source.playing : null,
            clipUuid: clip ? clip._uuid : null,
            clipValid: clip ? api.isValid(clip, true) : null,
            clipRefCount: clip ? clip.refCount : null,
            clipCached: clip ? api.assetManager.assets.get(clip._uuid) === clip : null,
        };
    }
    function record(phase, more) {
        marks.push(Object.assign({ phase: phase, ms: Math.round(performance.now() - begin),
            frame: director.getTotalFrames() }, status(), more || {}));
    }
    function load(name) {
        return new Promise(function (resolve, reject) {
            director.loadScene(name, function (error) { error ? reject(error) : resolve(); });
        });
    }
    try {
        await load('stage8-audio-static');
        scene = director.getScene();
        source = scene.getChildByName('stage8-tone-a').getComponent(api.AudioSource);
        clip = source && source.clip;
        var deps = api.assetManager.dependUtil.getDeps(scene.uuid) || [];
        record('loaded-static-scene', { autoRelease: autoRelease, sceneId: scene.uuid,
            sourceClipPresent: Boolean(clip), dependencyCount: deps.length,
            clipInSceneDeps: clip ? deps.indexOf(clip._uuid) !== -1 : null,
            expectedClipInSceneDeps: deps.indexOf('bad34118-5546-4cc6-82cd-3e113d650832') !== -1 });
        if (!clip) throw new Error('serialized AudioSource clip did not resolve');
        var oldDestroy = clip.destroy;
        clip.destroy = function () {
            record('clip:destroy-before');
            var result = oldDestroy.call(this);
            record('clip:destroy-after');
            return result;
        };
        scene.autoReleaseAssets = autoRelease;
        source.play();
        await new Promise(function (resolve) { setTimeout(resolve, 200); });
        record('before-switch');
        await load('stage4-empty');
        record('switch-callback');
        await new Promise(function (resolve) { setTimeout(resolve, 400); });
        record('after-switch-400ms');
        console.log('STAGE8_AUDIO_LIFECYCLE_38_STATIC', JSON.stringify({
            version: '3.8.7', branch: autoRelease ? 'autoRelease=true' : 'autoRelease=false', marks: marks }));
    } catch (error) {
        console.error('STAGE8_AUDIO_LIFECYCLE_38_STATIC_ERROR', String(error), JSON.stringify(marks));
    }
})();
