// Browser preview runtime channel. Reconnects only to the Host session from the local preview URL.
(function (root, factory) {
    var value = factory();
    if (typeof module === 'object' && module.exports) module.exports = value;
    root.CocosAgentContentRuntimeClient = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    function session() {
        if (typeof location === 'undefined' || typeof WebSocket === 'undefined') return null;
        var query = new URLSearchParams(location.search);
        var port = query.get('cocosAgentPort');
        var token = query.get('cocosAgentToken');
        if (location.hostname !== '127.0.0.1' || !/^[1-9][0-9]{0,4}$/.test(port || '')
            || Number(port) > 65535 || !/^[0-9a-f]{64}$/.test(token || '')) return null;
        return { port: port, token: token };
    }
    function connect(options) {
        var entry = session();
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
                active.send(JSON.stringify({ type: 'hello', creatorVersion: options.creatorVersion, scene: options.scene }));
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
    return { connect: connect, session: session };
});
