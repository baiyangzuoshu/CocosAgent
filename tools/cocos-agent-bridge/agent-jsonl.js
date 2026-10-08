'use strict';

const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { dispatch } = require('./agent-dispatch');
const composition = require('./scene-composition');
const assetBatch = require('./asset-batch');
const contentRelease = require('./content-release');

const catalogMethods = new Set(['instances.list', 'instances.get', 'capabilities.list']);
const workflowMethods = new Set(['workflow.plan', 'workflow.execute', 'workflow.get', 'workflow.compensate', 'workflow.replay']);
const batchMethods = new Set(['assets.batch.plan', 'assets.batch.execute', 'assets.batch.get']);
const contentMethods = new Set(['content.plan', 'content.stage', 'content.get', 'content.select', 'content.rollback', 'content.runtime.accept']);
const methods = new Set([...catalogMethods, ...workflowMethods, ...batchMethods, ...contentMethods, 'command.execute', 'operation.get', 'preview.accept']);
const versions = new Set(['2.4.15', '3.8.7']);

function error(code, message) { return { code, message }; }
function validTargets(targets) {
    return Array.isArray(targets) && targets.length > 0 && targets.every((target) =>
        target && versions.has(target.creatorVersion) && typeof target.projectRoot === 'string' && path.isAbsolute(target.projectRoot));
}
function catalog(request, run = spawnSync) {
    const { method, params } = request;
    if (!validTargets(params.targets) || (method !== 'instances.list' && typeof params.projectRoot !== 'string')
        || (params.creatorVersion !== undefined && !versions.has(params.creatorVersion))) {
        return { success: false, error: error('INVALID_ARGUMENT', 'Provide absolute Creator targets and a valid project/version selection.') };
    }
    const args = [path.join(__dirname, 'catalog-host.js'),
        ...params.targets.flatMap((target) => ['--target', `${target.creatorVersion}=${target.projectRoot}`]), '--query', method];
    if (params.projectRoot !== undefined) args.push('--project', params.projectRoot);
    if (params.creatorVersion !== undefined) args.push('--creator-version', params.creatorVersion);
    const child = run(process.execPath, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    try {
        const result = JSON.parse((child.stdout || '').trim());
        if (typeof result.success === 'boolean') return result;
    } catch (_) { /* Return a structured transport error below. */ }
    return { success: false, error: error('CATALOG_FAILED', 'Catalog Host did not return JSON.') };
}
function handle(request, adapters = {}) {
    if (!request || typeof request !== 'object' || Array.isArray(request) || !Number.isSafeInteger(request.id)
        || !methods.has(request.method) || !request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
        return { id: request && Number.isSafeInteger(request.id) ? request.id : null,
            result: { success: false, error: error('INVALID_ARGUMENT', 'Provide integer id, supported method, and object params.') } };
    }
    const { method, params } = request;
    if (catalogMethods.has(method)) return { id: request.id, result: (adapters.catalog || catalog)(request) };
    if (workflowMethods.has(method)) return { id: request.id,
        result: (adapters.workflow || composition.handle)(method, params, adapters.dispatch || dispatch) };
    if (batchMethods.has(method)) return { id: request.id,
        result: (adapters.assetBatch || assetBatch.handle)(method, params, adapters.dispatch || dispatch) };
    if (contentMethods.has(method)) return { id: request.id,
        result: (adapters.contentRelease || contentRelease.handle)(method, params) };
    let dispatchRequest;
    if (method === 'command.execute') dispatchRequest = {
        targets: params.targets, projectRoot: params.projectRoot, creatorVersion: params.creatorVersion,
        command: params.command, input: params.input,
    };
    else if (method === 'operation.get') dispatchRequest = {
        projectRoot: params.projectRoot, creatorVersion: params.creatorVersion, operationGetId: params.operationId,
    };
    else dispatchRequest = {
        projectRoot: params.projectRoot, creatorVersion: params.creatorVersion,
        previewAcceptId: params.operationId, evidence: params.evidence,
    };
    return { id: request.id, result: (adapters.dispatch || dispatch)(dispatchRequest) };
}

function main() {
    const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    input.on('line', (line) => {
        let response;
        if (Buffer.byteLength(line) > 1024 * 1024) response = { id: null, result: { success: false, error: error('REQUEST_TOO_LARGE', 'Request exceeds 1 MiB.') } };
        else {
            let request;
            try { request = JSON.parse(line); }
            catch (failure) { response = { id: null, result: { success: false, error: error('INVALID_JSON', failure.message) } }; }
            if (!response) {
                try { response = handle(request); }
                catch (_) { response = { id: request && Number.isSafeInteger(request.id) ? request.id : null,
                    result: { success: false, error: error('INTERNAL_ERROR', 'Local Agent request failed.') } }; }
            }
        }
        process.stdout.write(`${JSON.stringify(response)}\n`);
    });
}

if (require.main === module) main();
module.exports = { handle, catalog };
