(function () {
  'use strict';

  var channel = 'cocos-creator-lite-v1';
  var readySent = false;
  var cachedScene = null;

  function postToEditor(type, detail) {
    if (window.parent === window) return;
    window.parent.postMessage(
      {
        channel: channel,
        type: type,
        detail: detail || null,
      },
      window.location.origin,
    );
  }

  function waitForEngine() {
    var cc = window.cc;
    if (!cc || !cc.director || !cc.view || !cc.director.getRunningScene()) return;

    if (!window.CocosCreatorLiteBridge) {
      window.CocosCreatorLiteBridge = {
        version: '2.4.15',
        applyScene: applyScene,
      };
    }

    if (!readySent) {
      readySent = true;
      postToEditor('runtime-ready', { version: '2.4.15' });
      if (window.parent === window) {
        loadStandaloneScene();
      } else if (cachedScene) {
        applyScene(cachedScene);
      }
    }
  }

  function hexColor(cc, value) {
    var hex = String(value || '#ffffff').replace('#', '');
    if (hex.length !== 6) hex = 'ffffff';
    return new cc.Color(
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      255,
    );
  }

  function createColorSpriteFrame(cc) {
    var size = 64;
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    var texture = new cc.Texture2D();
    texture.initWithElement(canvas);
    return new cc.SpriteFrame(texture, cc.rect(0, 0, size, size));
  }

  function transformNode(cc, node, data) {
    var transform = data.transform || {};
    node.active = data.active !== false;
    node.setPosition(Number(transform.x) || 0, Number(transform.y) || 0);
    node.angle = Number(transform.rotation) || 0;
    node.setScale(
      Number.isFinite(Number(transform.scaleX)) ? Number(transform.scaleX) : 1,
      Number.isFinite(Number(transform.scaleY)) ? Number(transform.scaleY) : 1,
    );
  }

  function applyComponents(cc, node, data) {
    (data.components || []).forEach(function (componentData) {
      if (componentData.type === 'Label') {
        var label = node.addComponent(cc.Label);
        label.string = String(componentData.text || '');
        label.fontSize = Math.max(8, Number(componentData.fontSize) || 32);
        label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
        label.verticalAlign = cc.Label.VerticalAlign.CENTER;
        node.color = hexColor(cc, componentData.color);
      } else if (componentData.type === 'Sprite') {
        var sprite = node.addComponent(cc.Sprite);
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = createColorSpriteFrame(cc);
        node.setContentSize(
          Math.max(1, Number(componentData.width) || 100),
          Math.max(1, Number(componentData.height) || 100),
        );
        node.color = hexColor(cc, componentData.color);
      }
    });
  }

  function applyScene(sceneData) {
    var cc = window.cc;
    if (!cc || !sceneData || !Array.isArray(sceneData.nodes)) return false;

    cachedScene = sceneData;
    if (!cc.director.getRunningScene()) return false;

    var resolution = sceneData.designResolution || { width: 960, height: 640 };
    var width = Math.max(1, Number(resolution.width) || 960);
    var height = Math.max(1, Number(resolution.height) || 640);
    var scene = new cc.Scene();
    var rootData = sceneData.nodes.find(function (node) {
      return node.parentId === null;
    });
    var canvasNode = new cc.Node(rootData ? rootData.name : 'Canvas');
    canvasNode.setAnchorPoint(0.5, 0.5);
    canvasNode.setPosition(width / 2, height / 2);
    canvasNode.setContentSize(width, height);
    scene.addChild(canvasNode);

    var canvas = canvasNode.addComponent(cc.Canvas);
    canvas.designResolution = cc.size(width, height);
    canvas.fitWidth = true;
    canvas.fitHeight = true;
    canvasNode.active = !rootData || rootData.active !== false;

    var cameraNode = new cc.Node('Main Camera');
    cameraNode.setPosition(0, 0, 1000);
    cameraNode.parent = canvasNode;
    var camera = cameraNode.addComponent(cc.Camera);
    camera.ortho = true;
    camera.orthoSize = height / 2;
    camera.clearFlags =
      cc.Camera.ClearFlags.COLOR | cc.Camera.ClearFlags.DEPTH | cc.Camera.ClearFlags.STENCIL;
    camera.depth = -1;

    var nodeMap = new Map();
    if (rootData) nodeMap.set(rootData.id, canvasNode);
    sceneData.nodes.forEach(function (nodeData) {
      if (nodeData === rootData) return;
      var node = new cc.Node(nodeData.name || 'Node');
      transformNode(cc, node, nodeData);
      applyComponents(cc, node, nodeData);
      nodeMap.set(nodeData.id, node);
    });

    sceneData.nodes.forEach(function (nodeData) {
      if (nodeData === rootData) return;
      var node = nodeMap.get(nodeData.id);
      var parent = nodeMap.get(nodeData.parentId) || canvasNode;
      node.parent = parent;
    });

    cc.director.runSceneImmediate(scene);
    postToEditor('scene-applied', { name: sceneData.name || 'Main' });
    return true;
  }

  function loadStandaloneScene() {
    if (window.location.search.indexOf('editor=1') !== -1) return;
    fetch('scene.json')
      .then(function (response) {
        if (!response.ok) throw new Error('scene.json: HTTP ' + response.status);
        return response.json();
      })
      .then(function (sceneData) {
        applyScene(sceneData);
      })
      .catch(function (error) {
        console.error('[Cocos Creator Lite] Unable to load scene', error);
      });
  }

  window.addEventListener('message', function (event) {
    if (window.parent === window || event.source !== window.parent) return;
    if (event.origin !== window.location.origin) return;
    if (!event.data || event.data.channel !== channel) return;
    if (event.data.type === 'apply-scene') {
      cachedScene = event.data.scene;
      if (readySent) applyScene(cachedScene);
    }
  });

  window.setInterval(waitForEngine, 50);
})();
