'use strict';

const MAX_NODES = 30;
const MAX_DEPTH = 6;
const MAX_NAME_LENGTH = 32;
const MAX_PATH_LENGTH = 80;

module.exports = {
    'preflight-png-sprite'(event, params) {
        if (!params || !/^[0-9a-f-]{36}$/i.test(params.spriteFrameUuid || '')
            || !/^CocosAgentAsset_[A-Za-z0-9_-]{1,64}$/.test(params.nodeName || '')
            || !['apply', 'compensate', 'replay'].includes(params.action)) {
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
        }
        event.reply(null, {
            sceneName: scene.name,
            nodeName: params.nodeName,
            decision: params.action === 'compensate' ? (node ? 'remove' : 'alreadyAbsent') : (node ? 'alreadyApplied' : 'create'),
            targetNodeUuid: node ? node.uuid : null,
            canvasName: canvas.name,
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
        event.reply(null, {
            sceneName: scene.name || '',
            nodeCount: nodes.length,
            truncated,
            nodes,
            targetNodeName,
            targetNodeMatches,
            targetSearchComplete,
        });
    },

    'place-png-sprite'(event, params) {
        const fail = (code, message) => event.reply({ code, message });
        if (!params || !/^[0-9a-f-]{36}$/i.test(params.spriteFrameUuid || '')
            || !/^CocosAgentAsset_[A-Za-z0-9_-]{1,64}$/.test(params.nodeName || '')) {
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
            if (existingSprite && existingSprite.spriteFrame && existingSprite.spriteFrame._uuid === params.spriteFrameUuid) {
                event.reply(null, { nodeName: existing.name, nodeUuid: existing.uuid, alreadyApplied: true, spriteFrameUuid: params.spriteFrameUuid });
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
            node.setPosition(0, 0);
            node.setScale(64, 64, 1);
            canvas.addChild(node);
            event.reply(null, { nodeName: node.name, nodeUuid: node.uuid, alreadyApplied: false, spriteFrameUuid: spriteFrame._uuid });
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
