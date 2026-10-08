import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handleAsync } = require('../agent-jsonl.js');
const pipeline = require('../asset-scene-pipeline.js');

try {
    const response = await handleAsync(workerData.request, {
        assetScenePipeline: (method, params, run) => pipeline.handle(method, params, run,
            (progress) => parentPort.postMessage({ type: 'progress', progress })),
    });
    parentPort.postMessage({ type: 'result', response });
} catch (_) {
    parentPort.postMessage({ type: 'failure', code: 'WORKER_FAILED' });
}
