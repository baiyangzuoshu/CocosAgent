'use strict';

// Creator 2.4 installations wrap Electron's messageBox with either a
// synchronous integer, a callback, or a Promise response. Only button 1 is
// approval; unknown results and expired dialogs cannot grant permission.
module.exports = function confirmDialog(dialog, options, settings) {
    if (!dialog || typeof dialog.messageBox !== 'function')
        return Promise.reject(new Error('CREATOR_APPROVAL_DIALOG_UNAVAILABLE'));
    var timeoutMs = settings && settings.timeoutMs || 170000;
    return new Promise(function (resolve, reject) {
        var settled = false;
        var timer = setTimeout(function () {
            if (settled) return;
            settled = true;
            reject(new Error('CREATOR_APPROVAL_TIMED_OUT'));
        }, timeoutMs);
        if (timer.unref) timer.unref();
        function fail(error) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(new Error('CREATOR_APPROVAL_DIALOG_FAILED:' + String(error && error.message || error)));
        }
        function finish(result) {
            if (settled) return;
            if (result instanceof Error) { fail(result); return; }
            settled = true;
            clearTimeout(timer);
            var response = Number.isInteger(result) ? result
                : result && Number.isInteger(result.response) ? result.response : -1;
            resolve(response === 1);
        }
        try {
            var returned = dialog.messageBox(options, finish);
            if (Number.isInteger(returned) || returned && Number.isInteger(returned.response)) finish(returned);
            else if (returned && typeof returned.then === 'function') returned.then(finish, fail);
        } catch (error) { fail(error); }
    });
};
