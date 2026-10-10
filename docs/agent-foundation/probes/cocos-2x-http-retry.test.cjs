const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../../..');
const sourceRoot = path.join(root, '2.4.15engine/cocos2d/core/asset-manager');

function loadUtilities(timers) {
    const source = fs.readFileSync(path.join(sourceRoot, 'utilities.js'), 'utf8');
    const module = { exports: {} };
    const stubs = {
        './depend-util': {},
        './helper': { isScene: () => false, decodeUuid: (value) => value },
        './shared': { assets: {} },
        '../platform/utils': { callInNextTick: (callback) => callback() },
        '../assets/CCAsset': {},
    };
    const context = {
        module,
        exports: module.exports,
        CC_EDITOR: false,
        cc: {},
        setTimeout(callback, delay) {
            timers.push({ callback, delay });
            return timers.length;
        },
        require(id) {
            if (!(id in stubs)) throw Error(`Unexpected require: ${id}`);
            return stubs[id];
        },
    };
    vm.runInNewContext(source, context, { filename: 'utilities.js' });
    return module.exports;
}

function loadDownloadFile(status) {
    const source = fs.readFileSync(path.join(sourceRoot, 'download-file.js'), 'utf8');
    const module = { exports: {} };
    class FakeXMLHttpRequest {
        open(method, url, async) { this.request = { method, url, async }; }
        send() {
            this.status = status;
            this.response = status === 200 ? new Uint8Array([1, 2, 3]).buffer : null;
            if (status === 0) this.onerror();
            else this.onload();
        }
        setRequestHeader() {}
    }
    const context = {
        module,
        exports: module.exports,
        XMLHttpRequest: FakeXMLHttpRequest,
        require(id) {
            if (id !== './utilities') throw Error(`Unexpected require: ${id}`);
            return {
                parseParameters(options, onProgress, onComplete) {
                    return { options: options || {}, onProgress, onComplete };
                },
            };
        },
    };
    vm.runInNewContext(source, context, { filename: 'download-file.js' });
    return module.exports;
}

function captureDownloadError(status) {
    const downloadFile = loadDownloadFile(status);
    let result;
    downloadFile('http://localhost/test.png', {}, null, (error, response) => {
        result = { error, response };
    });
    return result;
}

function exerciseRetry(error, retryCount = 3) {
    const timers = [];
    const scheduledDelays = [];
    const utilities = loadUtilities(timers);
    let attempts = 0;
    let completion;
    utilities.retry((_index, done) => {
        attempts++;
        done(error, null);
    }, retryCount, 2000, (err, result) => {
        completion = { err, result };
    });
    while (timers.length) {
        const timer = timers.shift();
        scheduledDelays.push(timer.delay);
        timer.callback();
    }
    return { attempts, scheduledDelays, completion };
}

const notFound = captureDownloadError(404);
assert.equal(notFound.error.status, 404, 'HTTP errors preserve their response status');
assert.match(notFound.error.message, /status: 404/);
const missingResult = exerciseRetry(notFound.error);
assert.equal(missingResult.attempts, 1, '404 completes without retry');
assert.deepEqual(missingResult.scheduledDelays, []);
assert.equal(missingResult.completion.err.status, 404);

for (const status of [408, 425, 429, 500, 503]) {
    const result = exerciseRetry(captureDownloadError(status).error);
    assert.equal(result.attempts, 4, `HTTP ${status} retains the configured retry count`);
    assert.deepEqual(result.scheduledDelays, [2000, 2000, 2000]);
    assert.equal(result.completion.err.status, status);
}
for (const status of [400, 401, 403, 404, 410]) {
    const result = exerciseRetry(captureDownloadError(status).error);
    assert.equal(result.attempts, 1, `HTTP ${status} completes without retry`);
    assert.deepEqual(result.scheduledDelays, []);
}

const networkError = captureDownloadError(0).error;
assert.equal(networkError.status, undefined, 'transport errors remain distinct from HTTP responses');
assert.equal(exerciseRetry(networkError).attempts, 4, 'transport errors retain retries');

const success = captureDownloadError(200);
assert.equal(success.error, null);
assert.deepEqual(Array.from(new Uint8Array(success.response)), [1, 2, 3]);

process.stdout.write('Creator 2.4 HTTP retry policy checks passed\n');
