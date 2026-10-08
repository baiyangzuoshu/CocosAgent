'use strict';

const MAX_NODES = 30;
const MAX_DEPTH = 6;
const MAX_NAME_LENGTH = 32;
const MAX_PATH_LENGTH = 80;

module.exports = {
    'node-create-preflight'(event, params) {
        const scene = cc.director.getScene();
        const parts = params && typeof params.parentPath === 'string' ? params.parentPath.split('/') : [];
        if (!scene || parts[0] !== scene.name || parts.length > 32 || !params.parentUuid
            || !/^[A-Za-z0-9_ -]{1,64}$/.test(params.nodeName || '') || !validObjectSpec(params)) {
            event.reply({ code: 'INVALID_NODE_REQUEST', message: 'Invalid scene, parent path, or node name.' }); return;
        }
        let matches = [scene];
        for (const part of parts.slice(1)) matches = matches.flatMap((parent) => (parent.children || []).filter((child) => child.name === part)).slice(0, 3);
        if (matches.length !== 1 || matches[0].uuid !== params.parentUuid) {
            event.reply({ code: matches.length > 1 ? 'AMBIGUOUS_PARENT' : 'PARENT_CHANGED', message: 'Parent path and UUID do not identify one node.' }); return;
        }
        const children = matches[0].children.filter((child) => child.name === params.nodeName);
        if (params.action === 'compensate' && !children.length && params.targetNodeUuid) {
            let moved = false;
            function findUuid(node) { if (node.uuid === params.targetNodeUuid) moved = true; for (const child of node.children || []) findUuid(child); }
            findUuid(scene);
            if (moved) { event.reply({ code: 'SCENE_NODE_CONFLICT', message: 'Target node moved to another parent.' }); return; }
        }
        if (children.length > 1 || (children.length && (params.action !== 'compensate' || children[0].uuid !== params.targetNodeUuid))) {
            event.reply({ code: 'SCENE_NODE_CONFLICT', message: 'A child with this name already exists or has changed identity.' }); return;
        }
        if (params.action === 'compensate' && children.length && !nodeMatchesSpec(children[0], params)) {
            event.reply({ code: 'SCENE_OBJECT_CHANGED', message: 'Target node components or references changed after the operation.' }); return;
        }
        event.reply(null, { sceneName: scene.name, parentPath: params.parentPath, parentUuid: matches[0].uuid,
            nodeName: params.nodeName, targetNodeUuid: children[0] ? children[0].uuid : null,
            decision: params.action === 'compensate' ? (children.length ? 'remove' : 'alreadyAbsent') : 'create' });
    },

    'node-create-mutate'(event, params) {
        const scene = cc.director.getScene();
        const parts = params.parentPath.split('/');
        let matches = parts[0] === scene.name ? [scene] : [];
        for (const part of parts.slice(1)) matches = matches.flatMap((parent) => (parent.children || []).filter((child) => child.name === part)).slice(0, 3);
        if (matches.length !== 1 || matches[0].uuid !== params.parentUuid) {
            event.reply({ code: 'PARENT_CHANGED', message: 'Parent changed after preflight.' }); return;
        }
        const parent = matches[0];
        const children = parent.children.filter((child) => child.name === params.nodeName);
        if (params.action === 'compensate') {
            if (!children.length) {
                let moved = false;
                function findUuid(node) { if (node.uuid === params.targetNodeUuid) moved = true; for (const child of node.children || []) findUuid(child); }
                findUuid(scene);
                if (moved) { event.reply({ code: 'SCENE_NODE_CONFLICT', message: 'Target node moved to another parent.' }); return; }
                event.reply(null, { nodeName: params.nodeName, nodeUuid: params.targetNodeUuid, alreadyAbsent: true }); return;
            }
            if (children.length !== 1 || children[0].uuid !== params.targetNodeUuid) {
                event.reply({ code: 'SCENE_NODE_CONFLICT', message: 'Target identity changed after preflight.' }); return;
            }
            if (!nodeMatchesSpec(children[0], params)) {
                event.reply({ code: 'SCENE_OBJECT_CHANGED', message: 'Target node components or references changed after preflight.' }); return;
            }
            children[0].removeFromParent(false); children[0].destroy();
            event.reply(null, { nodeName: params.nodeName, nodeUuid: params.targetNodeUuid, removed: true }); return;
        }
        if (children.length) { event.reply({ code: 'SCENE_NODE_CONFLICT', message: 'A child with this name appeared after preflight.' }); return; }
        loadSpriteFrames(params.components, (error, loaded) => {
            if (error) { event.reply(error); return; }
            const node = new cc.Node(params.nodeName);
            if (params.transform && params.transform.position) node.setPosition(params.transform.position.x, params.transform.position.y);
            if (params.transform && params.transform.scale) node.setScale(params.transform.scale.x, params.transform.scale.y, 1);
            try {
                for (const spec of params.components || []) {
                    if (spec.classId === 'cc.Sprite') {
                        const component = node.addComponent(cc.Sprite);
                        component.spriteFrame = loaded[spec.spriteFrameUuid];
                    } else if (spec.classId === 'cc.Label') {
                        const component = node.addComponent(cc.Label);
                        component.string = spec.text;
                    }
                }
                parent.addChild(node);
            } catch (componentError) {
                node.destroy();
                event.reply({ code: 'COMPONENT_ATTACH_FAILED', message: String(componentError && componentError.message || componentError) });
                return;
            }
            event.reply(null, { nodeName: node.name, nodeUuid: node.uuid, created: true,
                components: componentDetails(node), transform: transformDetails(node) });
        });
    },
    'catalog-context'(event) {
        const scene = cc.director.getScene();
        event.reply(null, {
            sceneName: scene ? scene.name || '' : null,
            hasCanvas: !!(scene && scene.getChildByName('Canvas')),
        });
    },

    'preflight-png-sprite'(event, params) {
        if (!params || !/^[0-9a-f-]{36}$/i.test(params.spriteFrameUuid || '')
            || !/^CocosAgentAsset_[A-Za-z0-9_-]{1,64}$/.test(params.nodeName || '')
            || !['apply', 'compensate', 'replay'].includes(params.action)
            || (params.position && !validCanvasPosition(params.position))) {
            event.reply({ code: 'INVALID_SCENE_OPERATION', message: 'Invalid SpriteFrame operation.' });
            return;
        }
        const scene = cc.director.getScene();
        const canvas = scene && scene.getChildByName('Canvas');
        if (!scene || !canvas) {
            event.reply({ code: scene ? 'CANVAS_NOT_FOUND' : 'NO_OPEN_SCENE', message: 'The active scene needs a Canvas.' });
            return;
        }
        const node = canvas.getChildByName(params.nodeName);
        if (node) {
            const sprite = node.getComponent(cc.Sprite);
            if (!sprite || !sprite.spriteFrame || sprite.spriteFrame._uuid !== params.spriteFrameUuid) {
                event.reply({ code: 'SCENE_NODE_CONFLICT', message: 'The reserved node name has different data.' });
                return;
            }
            if (params.position && (Math.abs(node.x - params.position.x) > 1e-6 || Math.abs(node.y - params.position.y) > 1e-6)) {
                event.reply({ code: 'SCENE_NODE_CONFLICT', message: 'The reserved node has a different Canvas position.' });
                return;
            }
        }
        event.reply(null, {
            sceneName: scene.name,
            nodeName: params.nodeName,
            decision: params.action === 'compensate' ? (node ? 'remove' : 'alreadyAbsent') : (node ? 'alreadyApplied' : 'create'),
            targetNodeUuid: node ? node.uuid : null,
            canvasName: canvas.name,
            ...(params.position ? { position: params.position } : {}),
        });
    },

    snapshot(event, params) {
        const scene = cc.director.getScene();
        if (!scene) {
            event.reply({ code: 'NO_OPEN_SCENE', message: 'There is no active scene.' });
            return;
        }

        const nodes = [];
        let truncated = false;
        function visit(node, parentPath, depth) {
            if (nodes.length >= MAX_NODES) {
                truncated = true;
                return;
            }
            const rawName = typeof node.name === 'string' ? node.name : '';
            const name = rawName.slice(0, MAX_NAME_LENGTH);
            const rawPath = parentPath ? `${parentPath}/${name}` : name;
            const nodePath = rawPath.slice(0, MAX_PATH_LENGTH);
            if (rawName.length > MAX_NAME_LENGTH || rawPath.length > MAX_PATH_LENGTH) truncated = true;
            nodes.push({
                path: nodePath,
                name,
                active: node.active !== false,
                childCount: Array.isArray(node.children) ? node.children.length : 0,
            });
            if (depth >= MAX_DEPTH && node.children && node.children.length) {
                truncated = true;
                return;
            }
            for (const child of node.children || []) visit(child, nodePath, depth + 1);
        }

        visit(scene, '', 0);
        const targetNodeName = params && typeof params.targetNodeName === 'string' ? params.targetNodeName : '';
        const targetNodeMatches = [];
        let targetSearchComplete = true;
        if (targetNodeName) {
            let visited = 0;
            function findTarget(node, parentPath) {
                if (visited >= 10000) {
                    targetSearchComplete = false;
                    return;
                }
                visited++;
                const name = typeof node.name === 'string' ? node.name : '';
                const nodePath = parentPath ? `${parentPath}/${name}` : name;
                if (name === targetNodeName && targetNodeMatches.length < 3) {
                    targetNodeMatches.push({ uuid: node.uuid, path: nodePath.slice(0, MAX_PATH_LENGTH) });
                }
                for (const child of node.children || []) findTarget(child, nodePath);
            }
            findTarget(scene, '');
        }
        const targetNodePath = params && typeof params.targetNodePath === 'string' ? params.targetNodePath : '';
        let targetNode = null;
        if (targetNodePath) {
            const parts = targetNodePath.split('/');
            let matches = parts.length <= 32 && parts[0] === scene.name ? [scene] : [];
            for (const part of parts.slice(1)) {
                if (!part || matches.length > 2) { matches = []; break; }
                matches = matches.flatMap((parent) => (parent.children || []).filter((child) => child.name === part)).slice(0, 3);
            }
            if (matches.length === 1) {
                const node = matches[0];
                targetNode = { status: 'found', path: targetNodePath, uuid: node.uuid, name: node.name,
                    active: node.active !== false, childCount: node.children.length,
                    components: (node._components || []).slice(0, 32).map((component) => cc.js.getClassName(component)).filter(Boolean),
                    componentDetails: componentDetails(node), transform: transformDetails(node) };
            } else targetNode = { status: matches.length > 1 ? 'ambiguous' : 'not-found', path: targetNodePath };
        }
        event.reply(null, {
            sceneName: scene.name || '',
            nodeCount: nodes.length,
            truncated,
            nodes,
            targetNodeName,
            targetNodeMatches,
            targetSearchComplete,
            targetNode,
        });
    },

    'place-png-sprite'(event, params) {
        const fail = (code, message) => event.reply({ code, message });
        if (!params || !/^[0-9a-f-]{36}$/i.test(params.spriteFrameUuid || '')
            || !/^CocosAgentAsset_[A-Za-z0-9_-]{1,64}$/.test(params.nodeName || '')
            || (params.position && !validCanvasPosition(params.position))) {
            fail('INVALID_SCENE_OPERATION', 'A valid SpriteFrame UUID and reserved node name are required.');
            return;
        }
        const scene = cc.director.getScene();
        const canvas = scene && scene.getChildByName('Canvas');
        if (!canvas) {
            fail('CANVAS_NOT_FOUND', 'The active 2.4 scene must contain a Canvas node.');
            return;
        }
        const existing = canvas.getChildByName(params.nodeName);
        if (existing) {
            const existingSprite = existing.getComponent(cc.Sprite);
            const positionMatches = !params.position || (Math.abs(existing.x - params.position.x) <= 1e-6
                && Math.abs(existing.y - params.position.y) <= 1e-6);
            if (existingSprite && existingSprite.spriteFrame && existingSprite.spriteFrame._uuid === params.spriteFrameUuid && positionMatches) {
                event.reply(null, { nodeName: existing.name, nodeUuid: existing.uuid, alreadyApplied: true, spriteFrameUuid: params.spriteFrameUuid,
                    ...(params.position ? { position: params.position } : {}) });
            } else {
                fail('SCENE_NODE_CONFLICT', `A node named ${params.nodeName} already exists with different data.`);
            }
            return;
        }

        cc.assetManager.loadAny({ uuid: params.spriteFrameUuid }, (error, spriteFrame) => {
            if (error || !(spriteFrame instanceof cc.SpriteFrame)) {
                fail('SPRITE_FRAME_LOAD_FAILED', String(error && error.message || error || 'Loaded asset is not a SpriteFrame.'));
                return;
            }
            const node = new cc.Node(params.nodeName);
            const sprite = node.addComponent(cc.Sprite);
            sprite.spriteFrame = spriteFrame;
            const position = params.position || { x: 0, y: 0 };
            node.setPosition(position.x, position.y);
            node.setScale(64, 64, 1);
            canvas.addChild(node);
            event.reply(null, { nodeName: node.name, nodeUuid: node.uuid, alreadyApplied: false, spriteFrameUuid: spriteFrame._uuid,
                position: { x: node.x, y: node.y } });
        });
    },

    'remove-png-sprite'(event, params) {
        if (!params || !/^CocosAgentAsset_[A-Za-z0-9_-]{1,64}$/.test(params.nodeName || '')) {
            event.reply({ code: 'INVALID_SCENE_OPERATION', message: 'A reserved CocosAgent node name is required.' });
            return;
        }
        const scene = cc.director.getScene();
        const canvas = scene && scene.getChildByName('Canvas');
        const node = canvas && canvas.getChildByName(params.nodeName);
        if (!node) {
            event.reply(null, { nodeName: params.nodeName, removed: false, alreadyAbsent: true });
            return;
        }
        const sprite = node.getComponent(cc.Sprite);
        if (!sprite || !sprite.spriteFrame || sprite.spriteFrame._uuid !== params.spriteFrameUuid) {
            event.reply({ code: 'SCENE_NODE_CONFLICT', message: 'The node no longer matches the SpriteFrame used by this operation.' });
            return;
        }
        const nodeUuid = node.uuid;
        node.removeFromParent(false);
        node.destroy();
        event.reply(null, { nodeName: params.nodeName, nodeUuid, removed: true, alreadyAbsent: false });
    },
};

function validCanvasPosition(position) {
    return position && typeof position === 'object' && !Array.isArray(position)
        && Object.keys(position).length === 2 && Number.isFinite(position.x) && Number.isFinite(position.y)
        && Math.abs(position.x) <= 4096 && Math.abs(position.y) <= 4096;
}

function validObjectSpec(params) {
    const components = params && params.components === undefined ? [] : params && params.components;
    // Sprite and Label both extend RenderComponent, which disallows combining
    // renderer subclasses on one Node in Creator 2.4.
    if (!Array.isArray(components) || components.length > 1) return false;
    const seen = new Set();
    for (const component of components) {
        if (!component || typeof component !== 'object' || Array.isArray(component)
            || !['cc.Sprite', 'cc.Label'].includes(component.classId) || seen.has(component.classId)) return false;
        seen.add(component.classId);
        if (component.classId === 'cc.Sprite') {
            if (Object.keys(component).some((key) => !['classId', 'spriteFrameUuid'].includes(key))
                || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(component.spriteFrameUuid || '')) return false;
        } else if (Object.keys(component).some((key) => !['classId', 'text'].includes(key))
            || typeof component.text !== 'string' || component.text.length > 256) return false;
    }
    const transform = params.transform;
    if (transform !== undefined) {
        if (!transform || typeof transform !== 'object' || Array.isArray(transform)
            || Object.keys(transform).some((key) => !['position', 'scale'].includes(key))) return false;
        for (const key of ['position', 'scale']) {
            if (transform[key] !== undefined && (!transform[key] || typeof transform[key] !== 'object'
                || Array.isArray(transform[key]) || Object.keys(transform[key]).some((name) => !['x', 'y'].includes(name))
                || !Number.isFinite(transform[key].x) || !Number.isFinite(transform[key].y)
                || Math.abs(transform[key].x) > 4096 || Math.abs(transform[key].y) > 4096)) return false;
        }
    }
    return true;
}

function loadSpriteFrames(components, callback) {
    const specs = components || [];
    const spriteSpecs = specs.filter((item) => item.classId === 'cc.Sprite');
    const loaded = Object.create(null);
    if (!spriteSpecs.length) { callback(null, loaded); return; }
    let remaining = spriteSpecs.length;
    for (const spec of spriteSpecs) {
        cc.assetManager.loadAny({ uuid: spec.spriteFrameUuid }, (error, asset) => {
            if (error || !(asset instanceof cc.SpriteFrame)) {
                callback({ code: 'SPRITE_FRAME_LOAD_FAILED', message: String(error && error.message || error || 'Asset UUID is not a SpriteFrame.') });
                callback = function () {};
                return;
            }
            loaded[spec.spriteFrameUuid] = asset;
            remaining--;
            if (!remaining) callback(null, loaded);
        });
    }
}

function componentDetails(node) {
    return (node._components || []).map((component) => {
        const classId = cc.js.getClassName(component);
        if (classId === 'cc.Sprite') return { classId, spriteFrameUuid: component.spriteFrame && component.spriteFrame._uuid || null };
        if (classId === 'cc.Label') return { classId, text: component.string };
        return { classId };
    }).filter((item) => item.classId);
}

function transformDetails(node) {
    return { position: { x: node.x, y: node.y }, scale: { x: node.scaleX, y: node.scaleY } };
}

function nodeMatchesSpec(node, params) {
    const expected = params.components || [];
    const actual = componentDetails(node);
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
        if (actual[i].classId !== expected[i].classId) return false;
        if (expected[i].classId === 'cc.Sprite' && actual[i].spriteFrameUuid !== expected[i].spriteFrameUuid) return false;
        if (expected[i].classId === 'cc.Label' && actual[i].text !== expected[i].text) return false;
    }
    return true;
}
