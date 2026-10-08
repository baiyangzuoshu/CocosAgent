// Web preview and Mac native runtime channel. Reconnects only to an authenticated local Host session.
(function (root, factory) {
    var value = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = value;
    root.CocosAgentContentRuntimeClient = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    var NATIVE_SESSION_RELATIVE_PATH = 'cocos-agent/runtime-session.json';

    function nativeSession(cc) {
        if (!cc || !cc.sys || !cc.sys.isNative || cc.sys.os !== cc.sys.OS_OSX
            || typeof WebSocket === 'undefined' || typeof root.jsb === 'undefined'
            || !root.jsb.fileUtils || typeof root.jsb.fileUtils.getWritablePath !== 'function'
            || typeof root.jsb.fileUtils.getStringFromFile !== 'function') return null;
        var filename = root.jsb.fileUtils.getWritablePath() + NATIVE_SESSION_RELATIVE_PATH;
        var raw;
        try { raw = root.jsb.fileUtils.getStringFromFile(filename); } catch (_) { return null; }
        if (typeof raw !== 'string' || raw.length < 2 || raw.length > 4096) return null;
        var config;
        try { config = JSON.parse(raw); } catch (_) { return null; }
        if (!config || config.schemaVersion !== '0.1' || config.platform !== 'mac-native'
            || config.creatorVersion !== '2.4.15' || config.host !== '127.0.0.1'
            || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535
            || !/^[0-9a-f]{64}$/.test(config.token || '')
            || !/^[0-9a-f]{32}$/.test(config.sessionId || '')
            || !Number.isFinite(config.bootstrapExpiresAt) || Date.now() > config.bootstrapExpiresAt) return null;
        return { platform: config.platform, port: String(config.port), token: config.token, sessionId: config.sessionId };
    }

    function session(cc) {
        if (cc && cc.sys && cc.sys.isNative) return nativeSession(cc);
        if (typeof location === 'undefined' || typeof WebSocket === 'undefined') return null;
        var query = new URLSearchParams(location.search);
        var port = query.get('cocosAgentPort');
        var token = query.get('cocosAgentToken');
        if (location.hostname !== '127.0.0.1' || !/^[1-9][0-9]{0,4}$/.test(port || '')
            || Number(port) > 65535 || !/^[0-9a-f]{64}$/.test(token || '')) return null;
        return { platform: 'web-preview', port: port, token: token, sessionId: null };
    }
    function connect(options) {
        var entry = session(options && options.cc);
        if (!entry) return null;
        if (!options || !options.runtime || !options.creatorVersion || !options.scene) throw Error('INVALID_RUNTIME_CLIENT');
        var socket = null;
        var closed = false;
        var retry = null;
        var queue = Promise.resolve();
        function open() {
            if (closed) return;
            var active = new WebSocket('ws://127.0.0.1:' + entry.port + '/runtime?token=' + entry.token);
            socket = active;
            active.onopen = function () {
                active.send(JSON.stringify({ type: 'hello', platform: entry.platform,
                    sessionId: entry.sessionId, creatorVersion: options.creatorVersion, scene: options.scene }));
            };
            active.onmessage = function (event) {
                var message;
                try { message = JSON.parse(event.data); } catch (_) { return; }
                if (message.type !== 'apply' || !Number.isSafeInteger(message.id) || !message.release) return;
                queue = queue.then(function () {
                    if (closed) return;
                    return options.runtime.apply(message.release, message.assetId).then(function (receipt) {
                        if (!closed && active.readyState === WebSocket.OPEN) active.send(JSON.stringify({ type: 'receipt', id: message.id, receipt: receipt }));
                    }, function (error) {
                        if (options.onError) options.onError(error);
                        if (!closed && active.readyState === WebSocket.OPEN) active.send(JSON.stringify({ type: 'receipt', id: message.id,
                            receipt: { outcome: 'needs-review', releaseId: message.release.releaseId, code: 'RUNTIME_EXCEPTION' } }));
                    });
                }).catch(function (error) {
                    if (options.onError) options.onError(error);
                });
            };
            active.onerror = function (event) { if (options.onError) options.onError(event); };
            active.onclose = function () {
                if (!closed && socket === active) retry = setTimeout(open, 500);
            };
        }
        open();
        return { close: function () { closed = true; clearTimeout(retry); if (socket) socket.close(); },
            get socket() { return socket; } };
    }
    return { connect: connect, session: session, nativeSessionRelativePath: NATIVE_SESSION_RELATIVE_PATH };
});
