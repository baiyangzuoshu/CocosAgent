// Creator 2.4.15 Web preview. This is a controlled in-memory dependency
// experiment, not an editor-imported static scene reference.
(async function () {
    var director = cc.director;
    var scene = director.getScene();
    var autoRelease = Boolean(window.__stage8AudioAutoRelease);
    var marks = [];
    var begin = performance.now();
    var clip, node, source, id;
    var dependUtil = cc.assetManager.dependUtil;
    function status() {
        return {
            scene: director.getScene() && director.getScene().name,
            sceneValid: scene ? cc.isValid(scene, true) : null,
            sourceNodeValid: node ? cc.isValid(node, true) : null,
            sourceState: source && source.audio ? source.audio.getState() : null,
            clipUuid: clip ? clip._uuid : null,
            clipValid: clip ? cc.isValid(clip, true) : null,
            clipRefCount: clip ? clip.refCount : null,
            clipCached: clip ? cc.assetManager.assets.get(clip._uuid) === clip : null,
            clipInSceneDeps: clip ? dependUtil.getDeps(scene._id).indexOf(clip._uuid) !== -1 : null,
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
        if (!scene || scene.name !== 'helloworld') throw new Error('expected helloworld start scene');
        clip = await new Promise(function (resolve, reject) {
            cc.resources.load('stage8-tone-a', cc.AudioClip, function (error, value) {
                error ? reject(error) : resolve(value);
            });
        });
        record('dynamic-clip-loaded', { autoRelease: autoRelease });
        var deps = dependUtil._depends.get(scene._id);
        if (!deps) {
            deps = { deps: [] };
            dependUtil._depends.add(scene._id, deps);
        }
        if (deps.deps.indexOf(clip._uuid) !== -1) throw new Error('Clip already in scene dependencies');
        // Reproduce the dependency registration and ownership count normally
        // produced when the editor serializes a scene property.
        deps.deps.push(clip._uuid);
        clip.addRef();
        record('dependency-injected', { dependencyCount: deps.deps.length });
        var oldDestroy = clip.destroy;
        clip.destroy = function () {
            record('clip:destroy-before');
            var result = oldDestroy.call(this);
            record('clip:destroy-after');
            return result;
        };
        node = new cc.Node('stage8-injected-audio-source');
        node.active = false;
        scene.addChild(node);
        source = node.addComponent(cc.AudioSource);
        source.playOnLoad = false;
        source.volume = 0.005;
        source.clip = clip;
        node.active = true;
        scene.autoReleaseAssets = autoRelease;
        source.play();
        id = cc.audioEngine.play(clip, true, 0.005);
        await new Promise(function (resolve) { setTimeout(resolve, 200); });
        record('before-switch');
        await load('stage4-empty');
        record('switch-callback');
        await new Promise(function (resolve) { setTimeout(resolve, 400); });
        record('after-switch-400ms');
        console.log('STAGE8_AUDIO_LIFECYCLE_INJECTED_SCENE_DEP_24', JSON.stringify({
            version: '2.4.15', branch: autoRelease ? 'autoRelease=true' : 'autoRelease=false', marks: marks }));
    } catch (error) {
        console.error('STAGE8_AUDIO_LIFECYCLE_INJECTED_SCENE_DEP_24_ERROR', String(error), JSON.stringify(marks));
    } finally {
        if (id && cc.audioEngine.getState(id) !== -1) cc.audioEngine.stop(id);
    }
})();
