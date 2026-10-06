// Creator 3.8.7 Web preview. Delay only the one-shot WebAudio XHR after it is
// opened, destroy its source node, then allow the request to complete.
// Browser policy is relaxed by creator-audio-headless-probe.mjs.
(async function () {
    var api = await System.import('cc');
    var scene = api.director.getScene();
    var marks = [];
    var startedAt = performance.now();
    var oldOpen, oldSend, oldStart, oldStop, sourceNode, originalUrl, clip, node;
    var delayedSend = null;
    var delay = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
    var mark = function (phase, extra) {
        marks.push(Object.assign({ phase: phase, ms: Math.round(performance.now() - startedAt),
            frame: api.director.getTotalFrames(), sourceNodeValid: node ? api.isValid(node) : null }, extra || {}));
    };
    try {
        if (!window.AudioBufferSourceNode) throw new Error('WebAudio unavailable');
        clip = await new Promise(function (resolve, reject) {
            api.resources.load('stage8-tone-b', api.AudioClip, function (error, value) { error ? reject(error) : resolve(value); });
        });
        if (clip.loadMode !== 1) throw new Error('expected WebAudio Clip');
        originalUrl = clip._nativeAsset.url;
        var delayedUrl = originalUrl + (originalUrl.indexOf('?') < 0 ? '?' : '&') + 'stage8_slow_load=' + Date.now();
        oldOpen = XMLHttpRequest.prototype.open;
        oldSend = XMLHttpRequest.prototype.send;
        oldStart = AudioBufferSourceNode.prototype.start;
        oldStop = AudioBufferSourceNode.prototype.stop;
        XMLHttpRequest.prototype.open = function (method, url) {
            this.__stage8SlowAudio = String(url) === delayedUrl;
            if (this.__stage8SlowAudio) mark('xhr:open', { url: String(url) });
            return oldOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function () {
            if (!this.__stage8SlowAudio) return oldSend.apply(this, arguments);
            var xhr = this, args = arguments;
            mark('xhr:send-delayed');
            delayedSend = function () { mark('xhr:send-released'); oldSend.apply(xhr, args); };
        };
        AudioBufferSourceNode.prototype.start = function () {
            sourceNode = this;
            mark('backend:start', { bufferDuration: this.buffer && this.buffer.duration });
            this.addEventListener('ended', function () { mark('backend:ended'); });
            return oldStart.apply(this, arguments);
        };
        AudioBufferSourceNode.prototype.stop = function () {
            mark('backend:stop-call', { isTarget: this === sourceNode });
            return oldStop.apply(this, arguments);
        };
        node = new api.Node('stage8-one-shot-slow-load');
        scene.addChild(node);
        var source = node.addComponent(api.AudioSource);
        source.playOnAwake = false;
        source.volume = 0.005;
        clip._nativeAsset.url = delayedUrl;
        mark('before-playOneShot', { clipUrlModified: true });
        source.playOneShot(clip, 1);
        clip._nativeAsset.url = originalUrl;
        for (var i = 0; i < 100 && !delayedSend; i++) await delay(20);
        if (!delayedSend) throw new Error('one-shot XHR was not intercepted');
        node.destroy();
        await delay(100);
        // Headless Chrome can throttle the Director frame that normally drains
        // deferred destruction. Force only this temporary node if still queued.
        var forcedImmediate = false;
        if (api.isValid(node)) { node._destroyImmediate(); forcedImmediate = true; }
        mark('after-source-destroy', { requestStillDelayed: true, forcedImmediate: forcedImmediate });
        if (api.isValid(node)) throw new Error('node was not destroyed before request release');
        delayedSend();
        for (var j = 0; j < 100 && !sourceNode; j++) await delay(20);
        await delay(100);
        mark('after-request-completion', { backendStarted: !!sourceNode,
            stopCallsForTarget: marks.filter(function (x) { return x.phase === 'backend:stop-call' && x.isTarget; }).length });
        console.log('STAGE8_AUDIO_LIFECYCLE_38', JSON.stringify({ version: '3.8.7', branch: 'one-shot-WebAudio-slow-load-node-destroy', marks: marks }));
    } catch (error) {
        console.error('STAGE8_AUDIO_LIFECYCLE_38_ERROR', String(error), JSON.stringify(marks));
    } finally {
        if (clip && originalUrl) clip._nativeAsset.url = originalUrl;
        if (oldOpen) XMLHttpRequest.prototype.open = oldOpen;
        if (oldSend) XMLHttpRequest.prototype.send = oldSend;
        if (oldStart) AudioBufferSourceNode.prototype.start = oldStart;
        if (oldStop) AudioBufferSourceNode.prototype.stop = oldStop;
        if (node && api.isValid(node)) node.destroy();
    }
})();
