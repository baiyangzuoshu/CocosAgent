'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dispatch } = require('./agent-dispatch');

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stepId = /^[a-z][a-z0-9_-]{0,31}$/;
const nodeName = /^[A-Za-z0-9_ -]{1,64}$/;
function issue(code, message, extra = {}) { return { success: false, outcome: 'failed', error: { code, message }, ...extra }; }
function storageFile(projectRoot, workflowId) {
    if (!uuid.test(workflowId || '')) throw new Error('INVALID_WORKFLOW_ID');
    return path.join(path.resolve(projectRoot), '.cocos-agent', 'compositions', `${workflowId}.json`);
}
function read(projectRoot, workflowId) { return JSON.parse(fs.readFileSync(storageFile(projectRoot, workflowId), 'utf8')); }
function write(record, create = false) {
    const filename = storageFile(record.projectRoot, record.workflowId);
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    if (create) { fs.writeFileSync(filename, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 }); return; }
    const temporary = `${filename}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try { fs.writeFileSync(temporary, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 }); fs.renameSync(temporary, filename); }
    finally { try { fs.unlinkSync(temporary); } catch (_) { /* rename consumed it */ } }
}
function save(record) { record.updatedAt = new Date().toISOString(); write(record); }
function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
    return value;
}
function samePlan(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
function validComponents(components) {
    if (!Array.isArray(components) || components.length > 1) return false;
    return components.every((component) => {
        if (!component || typeof component !== 'object' || Array.isArray(component)) return false;
        if (component.classId === 'cc.Sprite') return Object.keys(component).every((key) => ['classId', 'spriteFrameUuid'].includes(key))
            && uuid.test(component.spriteFrameUuid || '');
        return component.classId === 'cc.Label' && Object.keys(component).every((key) => ['classId', 'text'].includes(key))
            && typeof component.text === 'string' && component.text.length <= 256;
    });
}
function validTransform(transform) {
    if (!transform || typeof transform !== 'object' || Array.isArray(transform)
        || Object.keys(transform).some((key) => !['position', 'scale'].includes(key))) return false;
    return ['position', 'scale'].every((key) => transform[key] === undefined || (transform[key]
        && typeof transform[key] === 'object' && !Array.isArray(transform[key])
        && Object.keys(transform[key]).length === 2 && Number.isFinite(transform[key].x) && Number.isFinite(transform[key].y)
        && Math.abs(transform[key].x) <= 4096 && Math.abs(transform[key].y) <= 4096));
}
function validSteps(steps, creatorVersion) {
    if (!Array.isArray(steps) || steps.length < 2 || steps.length > 8) return false;
    const seen = new Set();
    const siblingNames = new Set();
    for (const step of steps) {
        if (!step || typeof step !== 'object' || Array.isArray(step)
            || Object.keys(step).some((key) => !['id', 'name', 'parent', 'components', 'transform'].includes(key))
            || !stepId.test(step.id || '') || seen.has(step.id) || !nodeName.test(step.name || '')
            || !step.parent || typeof step.parent !== 'object' || Array.isArray(step.parent)
            || (step.components !== undefined && (creatorVersion !== '2.4.15' || !validComponents(step.components)))
            || (step.transform !== undefined && (creatorVersion !== '2.4.15' || !validTransform(step.transform)))) return false;
        const parent = step.parent;
        const isRef = Object.keys(parent).length === 1 && stepId.test(parent.ref || '') && seen.has(parent.ref);
        const isPath = Object.keys(parent).length === 2 && typeof parent.path === 'string' && parent.path.length > 0
            && parent.path.length <= 170 && !parent.path.includes('//') && !parent.path.includes('\\')
            && typeof parent.uuid === 'string' && parent.uuid.length > 0 && parent.uuid.length <= 64;
        if (!isRef && !isPath) return false;
        const siblingKey = `${isRef ? `ref:${parent.ref}` : `uuid:${parent.uuid}`}\0${step.name}`;
        if (siblingNames.has(siblingKey)) return false;
        siblingNames.add(siblingKey);
        seen.add(step.id);
    }
    return true;
}
function targetRequest(params) {
    return { targets: params.targets, projectRoot: params.projectRoot, creatorVersion: params.creatorVersion };
}
function inspect(params, nodePath, run) {
    return run({ ...targetRequest(params), command: 'scene.node.inspect', input: { nodePath } });
}
function plan(params, run = dispatch) {
    if (!params || !validSteps(params.steps, params.creatorVersion) || !['2.4.15', '3.8.7'].includes(params.creatorVersion)
        || typeof params.projectRoot !== 'string' || !path.isAbsolute(params.projectRoot)
        || !Array.isArray(params.targets) || !params.targets.length) return issue('INVALID_PLAN', 'Provide one target and 2–8 ordered node steps.');
    let instance = null;
    for (const step of params.steps) {
        if (step.parent.ref) continue;
        const parent = inspect(params, step.parent.path, run);
        if (!parent.success || !parent.result || !parent.result.node || parent.result.node.status !== 'found'
            || parent.result.node.uuid !== step.parent.uuid) return issue('PARENT_CHANGED', `Parent for ${step.id} is unavailable or has a different UUID.`);
        if (!instance) instance = parent.instance;
        else if (!parent.instance || parent.instance.instanceId !== instance.instanceId || parent.instance.activeScene !== instance.activeScene)
            return issue('INSTANCE_CHANGED', 'Editor instance or scene changed during planning.');
        const target = inspect(params, `${step.parent.path}/${step.name}`, run);
        if (!target.success || !target.result || !target.result.node || target.result.node.status !== 'not-found'
            || !target.instance || target.instance.instanceId !== instance.instanceId)
            return issue('SCENE_NODE_CONFLICT', `Target name for ${step.id} is already present or cannot be checked.`);
    }
    if (!instance) return issue('INVALID_PLAN', 'At least one step must use an existing parent path.');
    const paths = new Map();
    for (const step of params.steps) {
        const parentPath = step.parent.path || paths.get(step.parent.ref);
        const resolvedPath = `${parentPath}/${step.name}`;
        if (resolvedPath.length > 240) return issue('NODE_PATH_TOO_LONG', `Resolved path for ${step.id} exceeds 240 characters.`);
        paths.set(step.id, resolvedPath);
    }
    return { success: true, outcome: 'ready', instance, steps: params.steps };
}
function publicRecord(record) {
    return { success: record.state === 'completed' || record.state === 'compensated', outcome: record.state,
        workflowId: record.workflowId, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion,
        sceneName: record.sceneName, steps: record.steps.map((step) => ({ id: step.id, name: step.name,
            parent: step.parent, ...(step.components !== undefined ? { components: step.components } : {}),
            ...(step.transform !== undefined ? { transform: step.transform } : {}), status: step.status, operationId: step.operationId,
            nodeUuid: step.nodeUuid, compensationId: step.compensationId })),
        error: record.error || null, replayedFrom: record.replayedFrom || null };
}
function resolvedParent(record, step) {
    if (step.parent.path) return { path: step.parent.path, uuid: step.parent.uuid };
    const source = record.steps.find((item) => item.id === step.parent.ref);
    if (!source || source.status !== 'applied' || !source.nodeUuid || !source.resolvedParent) return null;
    return { path: `${source.resolvedParent.path}/${source.name}`, uuid: source.nodeUuid };
}
function reconcile(record, run) {
    for (const step of record.steps) {
        if (step.status !== 'applying' && step.status !== 'compensating') continue;
        const operationId = step.status === 'applying' ? step.operationId : step.compensationId;
        const result = run({ projectRoot: record.projectRoot, creatorVersion: record.creatorVersion, operationGetId: operationId });
        if (!result.success || !result.phases || result.phases.disk !== 'passed'
            || (step.status === 'applying' && (step.components || []).length && result.phases.preview !== 'passed')) {
            if (result && !result.success && result.error && result.error.sideEffect === 'none') {
                step.status = 'rejected'; record.state = 'compensating';
                record.error = { code: 'STEP_REJECTED', stepId: step.id, operationId,
                    detail: { code: result.error.code, sideEffect: 'none' } };
                save(record); rollback(record, run); return false;
            }
            record.state = 'needs-review'; record.error = { code: 'STEP_OUTCOME_UNCERTAIN', stepId: step.id, operationId };
            save(record); return false;
        }
        if (step.status === 'applying') {
            if (!result.result || !result.result.nodeUuid) { record.state = 'needs-review'; save(record); return false; }
            step.status = 'applied'; step.nodeUuid = result.result.nodeUuid;
        } else step.status = 'compensated';
        save(record);
    }
    return true;
}
function rollback(record, run) {
    record.state = 'compensating'; save(record);
    for (const step of [...record.steps].reverse()) {
        if (step.status === 'compensated' || step.status === 'pending' || step.status === 'rejected') continue;
        if (step.status !== 'applied' || !step.resolvedParent) {
            record.state = 'needs-review'; record.error = { code: 'STEP_OUTCOME_UNCERTAIN', stepId: step.id }; save(record); return publicRecord(record);
        }
        step.status = 'compensating'; step.compensationId = step.compensationId || crypto.randomUUID(); save(record);
        const result = run({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion,
            command: 'scene.node.create', input: { parentPath: step.resolvedParent.path, parentUuid: step.resolvedParent.uuid,
                nodeName: step.name, action: 'compensate', sourceOperationId: step.operationId, operationId: step.compensationId } });
        if (!result.success || result.outcome !== 'completed' || !result.phases || result.phases.disk !== 'passed') {
            record.state = 'needs-review'; record.error = { code: 'COMPENSATION_UNCERTAIN', stepId: step.id,
                operationId: step.compensationId, detail: result.error || null }; save(record); return publicRecord(record);
        }
        step.status = 'compensated'; save(record);
    }
    record.state = record.error ? 'failed' : 'compensated'; save(record);
    return publicRecord(record);
}
function execute(params, run = dispatch) {
    if (!params || typeof params.projectRoot !== 'string' || !path.isAbsolute(params.projectRoot)
        || !validSteps(params.steps, params.creatorVersion) || !['2.4.15', '3.8.7'].includes(params.creatorVersion))
        return issue('INVALID_ARGUMENT', 'Provide an absolute project, version, and valid steps.');
    const workflowId = params && params.workflowId || crypto.randomUUID();
    if (!uuid.test(workflowId)) return issue('INVALID_WORKFLOW_ID', 'Workflow ID must be a UUID.');
    let record;
    try { record = read(params.projectRoot, workflowId); } catch (error) { if (error.code !== 'ENOENT') return issue('WORKFLOW_READ_FAILED', error.message); }
    if (!record) {
        const checked = plan(params, run);
        if (!checked.success) return checked;
        record = { contractVersion: '0.1', workflowId, projectRoot: path.resolve(params.projectRoot),
            creatorVersion: params.creatorVersion, targets: params.targets, sceneName: checked.instance.activeScene,
            instanceId: checked.instance.instanceId, state: 'executing', error: null, replayedFrom: params.replayedFrom || null,
            steps: params.steps.map((step) => ({ ...step, status: 'pending', operationId: crypto.randomUUID(),
                compensationId: null, nodeUuid: null, resolvedParent: null })),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        try { write(record, true); } catch (error) { return issue('WORKFLOW_RECORD_FAILED', error.message); }
    } else if (record.projectRoot !== path.resolve(params.projectRoot) || record.creatorVersion !== params.creatorVersion
        || !samePlan(record.steps.map(({ id, name, parent, components, transform }) => ({ id, name, parent,
            ...(components !== undefined ? { components } : {}), ...(transform !== undefined ? { transform } : {}) })), params.steps)) {
        return issue('WORKFLOW_CONFLICT', 'Workflow ID already belongs to another target or plan.');
    } else if (record.state === 'completed' || record.state === 'compensated' || record.state === 'failed') return publicRecord(record);
    if (!reconcile(record, run)) return publicRecord(record);
    if (record.state === 'compensating') return rollback(record, run);
    if (record.state === 'needs-review') return publicRecord(record);
    for (const step of record.steps) {
        if (step.status === 'applied') continue;
        const parent = resolvedParent(record, step);
        if (!parent) { record.state = 'needs-review'; record.error = { code: 'PARENT_UNRESOLVED', stepId: step.id }; save(record); return publicRecord(record); }
        const checkedParent = inspect(record, parent.path, run);
        if (!checkedParent.success || !checkedParent.result || !checkedParent.result.node
            || checkedParent.result.node.status !== 'found' || checkedParent.result.node.uuid !== parent.uuid
            || !checkedParent.instance || checkedParent.instance.instanceId !== record.instanceId
            || checkedParent.instance.activeScene !== record.sceneName) {
            record.state = 'needs-review'; record.error = { code: 'EXECUTION_CONTEXT_CHANGED', stepId: step.id };
            save(record); return publicRecord(record);
        }
        step.resolvedParent = parent; step.status = 'applying'; save(record);
        const result = run({ targets: record.targets, projectRoot: record.projectRoot, creatorVersion: record.creatorVersion,
            command: 'scene.node.create', input: { parentPath: parent.path, parentUuid: parent.uuid,
                nodeName: step.name, action: 'apply', operationId: step.operationId,
                ...(step.components !== undefined ? { components: step.components } : {}),
                ...(step.transform !== undefined ? { transform: step.transform } : {}) } });
        if (result.success && result.outcome === 'completed' && result.phases && result.phases.disk === 'passed'
            && (!(step.components || []).length || result.phases.preview === 'passed')
            && result.instance && result.instance.instanceId === record.instanceId && result.instance.activeScene === record.sceneName
            && result.result && typeof result.result.nodeUuid === 'string') {
            step.status = 'applied'; step.nodeUuid = result.result.nodeUuid; save(record); continue;
        }
        if (result.outcome === 'failed' && result.error && result.error.sideEffect === 'none') {
            step.status = 'rejected'; record.error = { code: 'STEP_REJECTED', stepId: step.id, detail: result.error }; save(record);
            return rollback(record, run);
        }
        record.state = 'needs-review'; record.error = { code: 'STEP_OUTCOME_UNCERTAIN', stepId: step.id,
            operationId: step.operationId, detail: result.error || null }; save(record); return publicRecord(record);
    }
    record.state = 'completed'; save(record); return publicRecord(record);
}
function get(params) {
    if (!params || typeof params.projectRoot !== 'string' || !uuid.test(params.workflowId || '')) return issue('INVALID_ARGUMENT', 'Project and workflow ID are required.');
    try { const record = read(params.projectRoot, params.workflowId);
        if (record.creatorVersion !== params.creatorVersion || record.projectRoot !== path.resolve(params.projectRoot)) return issue('WORKFLOW_TARGET_MISMATCH', 'Workflow target differs.');
        return publicRecord(record);
    } catch (error) { return issue(error.code === 'ENOENT' ? 'WORKFLOW_NOT_FOUND' : 'WORKFLOW_READ_FAILED', error.message); }
}
function compensate(params, run = dispatch) {
    if (!params || typeof params.projectRoot !== 'string' || !uuid.test(params.workflowId || ''))
        return issue('INVALID_ARGUMENT', 'Project and workflow ID are required.');
    let record;
    try { record = read(params.projectRoot, params.workflowId); } catch (error) { return issue('WORKFLOW_NOT_FOUND', error.message); }
    if (record.projectRoot !== path.resolve(params.projectRoot) || record.creatorVersion !== params.creatorVersion) return issue('WORKFLOW_TARGET_MISMATCH', 'Workflow target differs.');
    if (record.state === 'compensated' || record.state === 'failed') return publicRecord(record);
    if (record.state !== 'completed' && record.state !== 'compensating') return issue('WORKFLOW_NOT_COMPENSABLE', 'Resolve uncertain operations before compensation.', { workflowId: record.workflowId });
    if (!reconcile(record, run)) return publicRecord(record);
    return rollback(record, run);
}
function replay(params, run = dispatch) {
    if (!params || typeof params.projectRoot !== 'string' || !uuid.test(params.sourceWorkflowId || ''))
        return issue('INVALID_ARGUMENT', 'Project and source workflow ID are required.');
    let source;
    try { source = read(params.projectRoot, params.sourceWorkflowId); } catch (error) { return issue('SOURCE_WORKFLOW_NOT_FOUND', error.message); }
    if (!['compensated', 'failed'].includes(source.state) || source.projectRoot !== path.resolve(params.projectRoot)
        || source.creatorVersion !== params.creatorVersion || source.steps.some((step) => step.status === 'applied'))
        return issue('SOURCE_WORKFLOW_NOT_COMPENSATED', 'Replay requires a fully compensated workflow.');
    return execute({ ...params, targets: source.targets,
        steps: source.steps.map(({ id, name, parent, components, transform }) => ({ id, name, parent,
            ...(components !== undefined ? { components } : {}), ...(transform !== undefined ? { transform } : {}) })), replayedFrom: source.workflowId }, run);
}
function handle(method, params, run = dispatch) {
    if (method === 'workflow.plan') return plan(params, run);
    if (method === 'workflow.execute') return execute(params, run);
    if (method === 'workflow.get') return get(params);
    if (method === 'workflow.compensate') return compensate(params, run);
    if (method === 'workflow.replay') return replay(params, run);
    return issue('METHOD_NOT_FOUND', 'Unknown workflow method.');
}
if (require.main === module) {
    const argv = process.argv.slice(2);
    const value = (flag) => { const i = argv.indexOf(flag); return i < 0 ? undefined : argv[i + 1]; };
    let params;
    try { params = JSON.parse(value('--params') || '{}'); } catch (_) { params = null; }
    const result = handle(value('--method'), params);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.success ? 0 : 1;
}
module.exports = { handle, plan, execute, get, compensate, replay, validSteps };
