'use strict';

const MAX_NODES = 100;
const MAX_DEPTH = 6;
const MAX_NAME = 120;
const MAX_MUTATION_SCAN_NODES = 10000;
const MAX_MUTATION_SCAN_DEPTH = 64;

function snapshot(maxNodes) {
    const scene = cc && cc.director && cc.director.getScene && cc.director.getScene();
    if (!scene) return { available: false, reason: 'NO_ACTIVE_SCENE', sceneName: null, sceneUuid: null, nodes: [] };
    const limit = Number.isInteger(maxNodes) && maxNodes > 0 ? Math.min(maxNodes, MAX_NODES) : MAX_NODES;
    const nodes = [];
    let truncated = false;
    function visit(node, parentPath, depth) {
        if (!node || nodes.length >= limit || depth > MAX_DEPTH) { truncated = true; return; }
        const name = String(node.name || '').slice(0, MAX_NAME);
        const nodePath = parentPath ? `${parentPath}/${name}` : name;
        const components = typeof node.getComponents === 'function' && cc.Component ? node.getComponents(cc.Component) : [];
        nodes.push({ name, path: nodePath, uuid: typeof node.uuid === 'string' ? node.uuid : null,
            active: node.active !== false, children: Array.isArray(node.children) ? node.children.length : 0,
            components: Array.isArray(components) ? components.map((item) => item && item.constructor && item.constructor.name)
                .filter((item) => typeof item === 'string').slice(0, 16) : [] });
        const children = Array.isArray(node.children) ? node.children : [];
        for (const child of children) {
            if (nodes.length >= limit) { truncated = true; break; }
            visit(child, nodePath, depth + 1);
        }
    }
    visit(scene, '', 0);
    return { available: true, sceneName: String(scene.name || '').slice(0, MAX_NAME),
        sceneUuid: typeof scene.uuid === 'string' ? scene.uuid : null,
        nodeCount: nodes.length, truncated, nodes };
}

function locateNode(sceneUuid, nodeUuid) {
    const scene = cc && cc.director && cc.director.getScene && cc.director.getScene();
    if (!scene) return { state: { available: false, reason: 'NO_ACTIVE_SCENE' }, node: null };
    if (typeof scene.uuid !== 'string' || scene.uuid !== sceneUuid)
        return { state: { available: false, reason: 'SCENE_IDENTITY_MISMATCH', sceneUuid: scene.uuid || null }, node: null };
    const stack = [{ node: scene, parentPath: '', depth: 0 }];
    let visited = 0;
    let truncated = false;
    const matches = [];
    while (stack.length) {
        const item = stack.pop();
        if (!item.node || item.depth > MAX_MUTATION_SCAN_DEPTH || visited >= MAX_MUTATION_SCAN_NODES) {
            truncated = true;
            continue;
        }
        visited += 1;
        const name = String(item.node.name || '').slice(0, MAX_NAME);
        const nodePath = item.parentPath ? `${item.parentPath}/${name}` : name;
        if (item.node.uuid === nodeUuid) matches.push({ node: item.node, path: nodePath });
        const children = Array.isArray(item.node.children) ? item.node.children : [];
        for (let index = children.length - 1; index >= 0; index -= 1) {
            if (item.depth >= MAX_MUTATION_SCAN_DEPTH || visited + stack.length >= MAX_MUTATION_SCAN_NODES) {
                truncated = true;
                break;
            }
            stack.push({ node: children[index], parentPath: nodePath, depth: item.depth + 1 });
        }
    }
    if (truncated) return { state: { available: false, reason: 'SCENE_SEARCH_LIMIT', sceneUuid: scene.uuid, visited }, node: null };
    if (matches.length === 0) return { state: { available: false, reason: 'SCENE_NODE_NOT_FOUND', sceneUuid: scene.uuid, visited }, node: null };
    if (matches.length !== 1) return { state: { available: false, reason: 'SCENE_NODE_UUID_AMBIGUOUS', sceneUuid: scene.uuid, visited }, node: null };
    const match = matches[0];
    if (match.path.length > 2048)
        return { state: { available: false, reason: 'SCENE_NODE_PATH_TOO_LONG', sceneUuid: scene.uuid, visited }, node: null };
    if (typeof match.node.active !== 'boolean')
        return { state: { available: false, reason: 'SCENE_NODE_ACTIVE_STATE_INVALID', sceneUuid: scene.uuid, visited }, node: null };
    return { node: match.node, state: { available: true, sceneName: String(scene.name || '').slice(0, MAX_NAME), sceneUuid: scene.uuid,
        nodeName: String(match.node.name || '').slice(0, MAX_NAME), nodeUuid: match.node.uuid,
        nodePath: match.path, active: match.node.active, visited } };
}

function findNode(sceneUuid, nodeUuid) {
    return locateNode(sceneUuid, nodeUuid).state;
}

function nodeState(params) {
    return findNode(params && params.sceneUuid, params && params.nodeUuid);
}

function setNodeActive(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.expectedActive !== 'boolean'
        || typeof params.active !== 'boolean') return { available: false, reason: 'SCENE_NODE_INPUT_INVALID' };
    const located = locateNode(params && params.sceneUuid, params && params.nodeUuid);
    const before = located.state;
    if (!before.available) return before;
    if (before.nodePath !== params.nodePath) return { available: false, reason: 'SCENE_NODE_PATH_MISMATCH', ...before };
    if (before.active !== params.expectedActive)
        return { available: false, reason: 'SCENE_NODE_PRECONDITION_FAILED', ...before };
    if (before.active === params.active)
        return { available: false, reason: 'SCENE_NODE_NO_CHANGE', ...before };
    const node = located.node;
    if (!node) return { available: false, reason: 'SCENE_NODE_NOT_FOUND' };
    node.active = params.active;
    if (node.active !== params.active)
        return { available: false, reason: 'SCENE_NODE_WRITE_READBACK_FAILED' };
    return { available: true, sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
        nodePath: params.nodePath, beforeActive: before.active, active: node.active };
}

module.exports = {
    snapshot(event, params) {
        try { event.reply(null, snapshot(params && params.maxNodes)); }
        catch (error) { event.reply({ code: 'SCENE_SNAPSHOT_FAILED', message: String(error && error.message || error) }); }
    },
    nodeState(event, params) {
        try { event.reply(null, nodeState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    setNodeActive(event, params) {
        try { event.reply(null, setNodeActive(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_WRITE_FAILED', message: String(error && error.message || error) }); }
    },
};
