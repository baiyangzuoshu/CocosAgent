'use strict';

const MAX_NODES = 30;
const MAX_DEPTH = 6;
const MAX_NAME_LENGTH = 32;
const MAX_PATH_LENGTH = 80;

module.exports = {
    'prefab-source-patch-mode'(event) {
        event.reply(null, prefabSourceRootInfo());
    },

    'prefab-source-patch-preflight'(event, params) {
        const rootInfo = prefabSourceRootInfo();
        if (rootInfo.prefabUuid !== params.prefabUuid) {
            event.reply({ code: 'PREFAB_MODE_TARGET_MISMATCH', message: 'The requested Prefab is not the active Prefab edit target.' }); return;
        }
        const node = findNodeByUuid(cc.director.getScene(), params.targetNodeUuid);
        const snapshot = node && nodePatchSnapshot(node, getNodePath(node));
        if (!snapshot || !matchesPrefabTargetPath(snapshot.path, params.targetNodePath)) {
            event.reply({ code: 'PREFAB_NODE_IDENTITY_MISMATCH', message: 'Prefab node path and UUID no longer identify the same node.' }); return;
        }
        if (!validPatchDiff(params.expectedDiff) || !patchMatches(snapshot, params.expectedDiff, 'before')) {
            event.reply({ code: 'EXPECTED_STATE_MISMATCH', message: 'One or more Prefab source fields differ from expected before values.' }); return;
        }
        if (patchNameConflict(node, params.expectedDiff)) {
            event.reply({ code: 'PREFAB_NODE_CONFLICT', message: 'The requested node name already belongs to a sibling.' }); return;
        }
        event.reply(null, { prefabUuid: rootInfo.prefabUuid, node: snapshot, expectedDiff: params.expectedDiff });
    },

    'prefab-source-patch-snapshot'(event, params) {
        const rootInfo = prefabSourceRootInfo();
        if (rootInfo.prefabUuid !== params.prefabUuid) {
            event.reply({ code: 'PREFAB_MODE_TARGET_MISMATCH', message: 'The requested Prefab is not the active Prefab edit target.' }); return;
        }
        const node = findNodeByUuid(cc.director.getScene(), params.targetNodeUuid);
        const snapshot = node && nodePatchSnapshot(node, getNodePath(node));
        if (!snapshot || !matchesPrefabTargetPath(snapshot.path, params.targetNodePath)) {
            event.reply({ code: 'PREFAB_NODE_IDENTITY_MISMATCH', message: 'Prefab node path and UUID no longer identify the same node.' }); return;
        }
        if (!validPatchDiff(params.expectedDiff) || !patchMatches(snapshot, params.expectedDiff, params.side)) {
            event.reply({ code: 'PREFAB_READBACK_MISMATCH', message: `Prefab fields do not match the expected ${params.side} values.` }); return;
        }
        event.reply(null, { prefabUuid: rootInfo.prefabUuid, node: snapshot,
            expectedDiff: params.expectedDiff, verifiedSide: params.side });
    },

    'prefab-source-patch-mutate'(event, params) {
        const rootInfo = prefabSourceRootInfo();
        if (rootInfo.prefabUuid !== params.prefabUuid) {
            event.reply({ code: 'PREFAB_MODE_TARGET_MISMATCH', message: 'The requested Prefab is not the active Prefab edit target.' }); return;
        }
        const node = findNodeByUuid(cc.director.getScene(), params.targetNodeUuid);
        const before = node && nodePatchSnapshot(node, getNodePath(node));
        if (!node || !matchesPrefabTargetPath(before.path, params.targetNodePath)
            || !validPatchDiff(params.expectedDiff) || !patchMatches(before, params.expectedDiff, 'before')) {
            event.reply({ code: 'EXPECTED_STATE_MISMATCH', message: 'Prefab source changed after preflight; no properties were written.' }); return;
        }
        if (patchNameConflict(node, params.expectedDiff)) {
            event.reply({ code: 'PREFAB_NODE_CONFLICT', message: 'A sibling with the requested name appeared after preflight.' }); return;
        }
        const spriteReferences = params.expectedDiff.filter((item) => item.path === 'component.cc.Sprite.spriteFrameUuid' && item.after !== null);
        const apply = (loadedFrames) => {
            try {
                params.expectedDiff.forEach((item) => setPatchValue(node, item, loadedFrames));
                const changed = nodePatchSnapshot(node, getNodePath(node));
                if (!patchMatches(changed, params.expectedDiff, 'after')) {
                    event.reply({ code: 'PREFAB_WRITE_READBACK_MISMATCH', message: 'The live Prefab node did not match the requested after values.' }); return;
                }
                event.reply(null, { prefabUuid: rootInfo.prefabUuid, node: changed, expectedDiff: params.expectedDiff });
            } catch (error) {
                event.reply({ code: 'PROPERTY_WRITE_FAILED', message: String(error && error.message || error) });
            }
        };
        if (!spriteReferences.length) { apply({}); return; }
        const loaded = Object.create(null);
        let remaining = spriteReferences.length;
        let settled = false;
        spriteReferences.forEach((item) => cc.assetManager.loadAny({ uuid: item.after }, (error, asset) => {
            if (settled) return;
            if (error || !(asset instanceof cc.SpriteFrame)) {
                settled = true;
                event.reply({ code: 'SPRITE_FRAME_LOAD_FAILED', message: String(error && error.message || error || 'Resource is not a SpriteFrame.') });
                return;
            }
            loaded[item.after] = asset;
            remaining -= 1;
            if (!remaining) { settled = true; apply(loaded); }
        }));
    },

    'node-prefab-create-name'(event, params) {
        const node = findNodeByUuid(cc.director.getScene(), params && params.nodeUuid);
        if (!node || node.name !== params.beforeName || !/^[A-Za-z0-9_ -]{1,64}$/.test(params.afterName || '')
            || (node.parent.children || []).some((sibling) => sibling !== node && sibling.name === params.afterName)) {
            event.reply({ code: 'PREFAB_NODE_CHANGED', message: 'Prefab root identity or name changed.' }); return;
        }
        node.name = params.afterName;
        event.reply(null, { nodeUuid: node.uuid, name: node.name });
    },
    'node-patch-preflight'(event, params) {
        const node = findPatchTarget(params);
        if (!node) { event.reply({ code: 'TARGET_CHANGED', message: 'Node path and UUID no longer identify the same scene node.' }); return; }
        const actual = nodePatchSnapshot(node, params.targetNodePath);
        const diff = params.expectedDiff || [];
        if (!validPatchDiff(diff) || !patchMatches(actual, diff, 'before')) {
            event.reply({ code: 'EXPECTED_STATE_MISMATCH', message: 'One or more fields differ from the expected before values.' }); return;
        }
        if (patchNameConflict(node, diff)) { event.reply({ code: 'SCENE_NODE_CONFLICT', message: 'The requested name already belongs to a sibling.' }); return; }
        event.reply(null, { sceneName: cc.director.getScene().name || '', node: actual, expectedDiff: diff });
    },

    'node-patch-mutate'(event, params) {
        const node = findPatchTarget(params);
        if (!node) { event.reply({ code: 'TARGET_CHANGED', message: 'Node path and UUID no longer identify the same scene node.' }); return; }
        const diff = params.expectedDiff || [];
        const before = nodePatchSnapshot(node, params.targetNodePath);
        if (!validPatchDiff(diff) || !patchMatches(before, diff, 'before')) {
            event.reply({ code: 'EXPECTED_STATE_MISMATCH', message: 'Scene changed after preflight; no properties were written.' }); return;
        }
        if (patchNameConflict(node, diff)) { event.reply({ code: 'SCENE_NODE_CONFLICT', message: 'A sibling with the requested name appeared after preflight.' }); return; }
        const spriteReferences = diff.filter((item) => item.path === 'component.cc.Sprite.spriteFrameUuid' && item.after !== null);
        const apply = (loadedFrames) => {
            try {
                diff.forEach((item) => setPatchValue(node, item, loadedFrames));
                event.reply(null, { sceneName: cc.director.getScene().name || '', node: nodePatchSnapshot(node, null), expectedDiff: diff });
            } catch (error) {
                event.reply({ code: 'PROPERTY_WRITE_FAILED', message: String(error && error.message || error) });
            }
        };
        if (!spriteReferences.length) { apply({}); return; }
        const loaded = Object.create(null);
        let remaining = spriteReferences.length;
        let settled = false;
        spriteReferences.forEach((item) => cc.assetManager.loadAny({ uuid: item.after }, (error, asset) => {
            if (settled) return;
            if (error || !(asset instanceof cc.SpriteFrame)) {
                settled = true;
                event.reply({ code: 'SPRITE_FRAME_LOAD_FAILED', message: String(error && error.message || error || 'Resource is not a SpriteFrame.') });
                return;
            }
            loaded[item.after] = asset;
            remaining -= 1;
            if (!remaining) { settled = true; apply(loaded); }
        }));
    },

    'node-patch-snapshot'(event, params) {
        const node = findNodeByUuid(cc.director.getScene(), params && params.nodeUuid);
        if (!node) { event.reply(null, { status: 'not-found', nodeUuid: params && params.nodeUuid }); return; }
        event.reply(null, Object.assign({ status: 'found', sceneName: cc.director.getScene().name || '' }, nodePatchSnapshot(node, getNodePath(node))));
    },

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
        const attach = (node) => {
            if (!node || !(node instanceof cc.Node)) { event.reply({ code: 'PREFAB_INSTANTIATE_FAILED', message: 'Prefab did not create a Node.' }); return; }
            node.name = params.nodeName;
            if (params.transform && params.transform.position) node.setPosition(params.transform.position.x, params.transform.position.y);
            if (params.transform && params.transform.scale) node.setScale(params.transform.scale.x, params.transform.scale.y, 1);
            try { parent.addChild(node); }
            catch (attachError) {
                node.destroy(); event.reply({ code: 'NODE_ATTACH_FAILED', message: String(attachError && attachError.message || attachError) }); return;
            }
            event.reply(null, { nodeName: node.name, nodeUuid: node.uuid, created: true,
                components: componentDetails(node), transform: transformDetails(node), prefabUuid: prefabUuidOf(node) });
        };
        if (params.prefabMode === 'instantiate') {
            cc.assetManager.loadAny({ uuid: params.prefabUuid }, (error, asset) => {
                if (error || !(asset instanceof cc.Prefab)) {
                    event.reply({ code: 'PREFAB_LOAD_FAILED', message: String(error && error.message || error || 'UUID does not identify a Prefab.') }); return;
                }
                try { attach(cc.instantiate(asset)); }
                catch (instantiateError) { event.reply({ code: 'PREFAB_INSTANTIATE_FAILED', message: String(instantiateError && instantiateError.message || instantiateError) }); }
            });
            return;
        }
        loadSpriteFrames(params.components, (error, loaded) => {
            if (error) { event.reply(error); return; }
            const node = new cc.Node(params.nodeName);
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
            } catch (componentError) {
                node.destroy(); event.reply({ code: 'COMPONENT_ATTACH_FAILED', message: String(componentError && componentError.message || componentError) }); return;
            }
            attach(node);
        });
    },
    'catalog-context'(event) {
        const scene = cc.director.getScene();
        event.reply(null, {
            sceneName: scene ? scene.name || '' : null,
            sceneUuid: scene && (typeof scene._id === 'string' ? scene._id : typeof scene.uuid === 'string' ? scene.uuid : null),
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

        const requestedSelection = Array.isArray(params && params.selectedNodeUuids)
            ? params.selectedNodeUuids.filter((uuid) => typeof uuid === 'string' && uuid.length <= 64) : [];
        const selectedNodeUuids = requestedSelection.slice(0, 8);
        const selectedNodes = selectedNodeUuids.map((uuid) => {
            const node = findNodeByUuid(scene, uuid);
            return node ? { status: 'found', uuid: node.uuid, path: getNodePath(node).slice(0, MAX_PATH_LENGTH),
                name: String(node.name || '').slice(0, MAX_NAME_LENGTH), active: node.active !== false,
                components: componentDetails(node).map((item) => item.classId).filter(Boolean).slice(0, 16) }
                : { status: 'not-in-active-scene', uuid };
        });

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
                    componentDetails: componentDetails(node), transform: transformDetails(node), prefabUuid: prefabUuidOf(node) };
            } else targetNode = { status: matches.length > 1 ? 'ambiguous' : 'not-found', path: targetNodePath };
        }
        event.reply(null, {
            sceneName: scene.name || '',
            sceneUuid: typeof scene._id === 'string' ? scene._id : typeof scene.uuid === 'string' ? scene.uuid : null,
            selectedNodes,
            selectionCount: selectedNodes.length,
            selectionTruncated: requestedSelection.length > selectedNodeUuids.length,
            selectionStatus: params && params.selectionAvailable === false ? 'unavailable' : 'read',
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
            node.setScale(1, 1, 1);
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
    const prefabMode = params.prefabMode === undefined ? null : params.prefabMode;
    if (prefabMode !== null && !['create', 'instantiate'].includes(prefabMode)) return false;
    const hasPrefabUuid = params.prefabUuid !== undefined && params.prefabUuid !== null;
    if (prefabMode === 'create' && hasPrefabUuid
        && (params.action !== 'compensate' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.prefabUuid || ''))) return false;
    if (prefabMode === 'instantiate' && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.prefabUuid || '') || components.length)) return false;
    if (prefabMode === null && hasPrefabUuid) return false;
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
        if (classId === 'cc.Sprite') return { classId, enabled: component.enabled !== false,
            spriteFrameUuid: component.spriteFrame && component.spriteFrame._uuid || null };
        if (classId === 'cc.Label') return { classId, enabled: component.enabled !== false, text: component.string };
        return { classId };
    }).filter((item) => item.classId);
}

function findNodeByUuid(root, uuid) {
    if (!root || typeof uuid !== 'string') return null;
    if (root.uuid === uuid) return root;
    for (const child of root.children || []) { const found = findNodeByUuid(child, uuid); if (found) return found; }
    return null;
}

function prefabSourceRootInfo() {
    const scene = cc.director.getScene();
    const roots = scene && scene.children && scene.children.length ? scene.children : scene ? [scene] : [];
    const candidates = new Set();
    roots.forEach((node) => {
        const asset = node && node._prefab && node._prefab.asset;
        const uuid = asset && (asset._uuid || asset.uuid);
        if (typeof uuid === 'string' && /^[0-9a-f-]{36}$/i.test(uuid)) candidates.add(uuid);
    });
    return { prefabUuid: candidates.size === 1 ? [...candidates][0] : null };
}

function matchesPrefabTargetPath(actualPath, expectedPath) {
    if (typeof actualPath !== 'string' || typeof expectedPath !== 'string') return false;
    const actual = actualPath.split('/'); const expected = expectedPath.split('/');
    return actual.length >= expected.length && expected.every((part, index) => actual[actual.length - expected.length + index] === part);
}

function getNodePath(node) {
    const names = [];
    for (let current = node; current; current = current.parent) names.unshift(current.name);
    return names.join('/');
}

function findTargetNode(nodePath, nodeUuid) {
    const scene = cc.director.getScene();
    if (!scene || typeof nodePath !== 'string' || typeof nodeUuid !== 'string') return null;
    const parts = nodePath.split('/');
    let matches = parts.length <= 32 && parts[0] === scene.name ? [scene] : [];
    for (const part of parts.slice(1)) matches = matches.flatMap((parent) => (parent.children || []).filter((child) => child.name === part)).slice(0, 3);
    return matches.length === 1 && matches[0].uuid === nodeUuid ? matches[0] : null;
}

function findPatchTarget(params) {
    if (!params || typeof params.targetNodePath !== 'string') return null;
    const parts = params.targetNodePath.split('/');
    const rename = Array.isArray(params.expectedDiff) && params.expectedDiff.find((item) => item.path === 'node.name');
    if (rename) parts[parts.length - 1] = rename.before;
    return findTargetNode(parts.join('/'), params.targetNodeUuid);
}

function patchNameConflict(node, diff) {
    const rename = diff.find((item) => item.path === 'node.name');
    return !!(rename && node.parent && node.parent.children.some((child) => child !== node && child.name === rename.after));
}

function nodePatchSnapshot(node, nodePath) {
    return { status: 'found', path: getNodePath(node), uuid: node.uuid, name: node.name, active: node.active !== false,
        transform: transformDetails(node), componentDetails: componentDetails(node), prefabUuid: prefabUuidOf(node) };
}

function prefabUuidOf(node) {
    const info = node && node._prefab;
    const asset = info && info.asset;
    return asset && typeof asset._uuid === 'string' ? asset._uuid : null;
}

function validPatchDiff(diff) {
    return Array.isArray(diff) && diff.length > 0 && diff.length <= 16 && diff.every((item) => item
        && typeof item.path === 'string' && ['node.name', 'node.active', 'node.position.x', 'node.position.y', 'node.scale.x', 'node.scale.y',
            'component.cc.Sprite.enabled', 'component.cc.Sprite.spriteFrameUuid', 'component.cc.Label.enabled'].includes(item.path));
}

function patchValue(snapshot, fieldPath) {
    if (fieldPath === 'node.name') return snapshot.name;
    if (fieldPath === 'node.active') return snapshot.active;
    const transform = fieldPath.match(/^node\.(position|scale)\.(x|y)$/);
    if (transform) return snapshot.transform[transform[1]][transform[2]];
    const component = fieldPath.match(/^component\.(cc\.(?:Sprite|Label))\.(enabled|spriteFrameUuid)$/);
    if (!component) return undefined;
    const found = (snapshot.componentDetails || []).filter((item) => item.classId === component[1]);
    if (found.length !== 1) return undefined;
    return found[0][component[2]];
}

function patchMatches(snapshot, diff, side) { return diff.every((item) => Object.is(patchValue(snapshot, item.path), item[side])); }

function setPatchValue(node, item, loadedFrames) {
    const path = item.path; const value = item.after;
    if (path === 'node.name') { node.name = value; return; }
    if (path === 'node.active') { node.active = value; return; }
    const transform = path.match(/^node\.(position|scale)\.(x|y)$/);
    if (transform) {
        const key = transform[1] === 'position' ? transform[2] : `scale${transform[2].toUpperCase()}`;
        if (transform[1] === 'position') node.setPosition(transform[2] === 'x' ? value : node.x, transform[2] === 'y' ? value : node.y);
        else if (key === 'scaleX') node.setScale(value, node.scaleY, node.scaleZ);
        else node.setScale(node.scaleX, value, node.scaleZ);
        return;
    }
    const componentPath = path.match(/^component\.(cc\.(?:Sprite|Label))\.(enabled|spriteFrameUuid)$/);
    if (!componentPath) throw new Error('Unsupported property path.');
    const matches = (node._components || []).filter((component) => cc.js.getClassName(component) === componentPath[1]);
    if (matches.length !== 1) throw new Error('Component path is missing or ambiguous.');
    const component = matches[0];
    if (componentPath[2] === 'enabled') component.enabled = value;
    else if (componentPath[2] === 'spriteFrameUuid') component.spriteFrame = value === null ? null : loadedFrames[value];
}

function transformDetails(node) {
    return { position: { x: node.x, y: node.y }, scale: { x: node.scaleX, y: node.scaleY } };
}

function nodeMatchesSpec(node, params) {
    const expected = params.components || [];
    const actual = componentDetails(node);
    if (params.prefabMode !== 'instantiate' && actual.length !== expected.length) return false;
    for (let i = 0; params.prefabMode !== 'instantiate' && i < expected.length; i++) {
        if (actual[i].classId !== expected[i].classId) return false;
        if (expected[i].classId === 'cc.Sprite' && actual[i].spriteFrameUuid !== expected[i].spriteFrameUuid) return false;
        if (expected[i].classId === 'cc.Label' && actual[i].text !== expected[i].text) return false;
    }
    if (params.prefabMode === 'instantiate' || params.prefabMode === 'create') {
        if (prefabUuidOf(node) !== params.prefabUuid) return false;
    }
    const actualTransform = transformDetails(node);
    for (const key of ['position', 'scale']) {
        const expectedTransform = params.transform && params.transform[key];
        if (expectedTransform && ['x', 'y'].some((axis) => Math.abs(actualTransform[key][axis] - expectedTransform[axis]) > 1e-5)) return false;
    }
    return true;
}
