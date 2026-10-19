'use strict';

const MAX_NODES = 100;
const MAX_DEPTH = 6;
const MAX_NAME = 120;

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

module.exports = {
    snapshot(event, params) {
        try { event.reply(null, snapshot(params && params.maxNodes)); }
        catch (error) { event.reply({ code: 'SCENE_SNAPSHOT_FAILED', message: String(error && error.message || error) }); }
    },
};
