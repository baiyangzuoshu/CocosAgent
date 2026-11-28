/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 3 步 | engine/2.4.15engine/cocos2d/core/renderer/render-flow.js:236-246 */
RenderFlow.render = function (rootNode, dt) {
    _batcher.reset();
    _batcher.walking = true;

    RenderFlow.visitRootNode(rootNode);

    _batcher.terminate();
    _batcher.walking = false;

    _forward.render(_batcher._renderScene, dt);
};

/* 第 4 步 | engine/2.4.15engine/cocos2d/core/renderer/render-flow.js:214-234 */
RenderFlow.visitRootNode = function (rootNode) {
    RenderFlow.validateRenderers();

    let preCullingMask = _cullingMask;
    _cullingMask = rootNode._cullingMask;

    if (rootNode._renderFlag & WORLD_TRANSFORM) {
        _batcher.worldMatDirty ++;
        rootNode._calculWorldMatrix();
        rootNode._renderFlag &= ~WORLD_TRANSFORM;

        flows[rootNode._renderFlag]._func(rootNode);

        _batcher.worldMatDirty --;
    }
    else {
        flows[rootNode._renderFlag]._func(rootNode);
    }

    _cullingMask = preCullingMask;
};

/* 第 5 步 | engine/2.4.15engine/cocos2d/core/renderer/render-flow.js:3-23 */
const DONOTHING = 1 << FlagOfset++;
const BREAK_FLOW = 1 << FlagOfset++;
const LOCAL_TRANSFORM = 1 << FlagOfset++;
const WORLD_TRANSFORM = 1 << FlagOfset++;
const TRANSFORM = LOCAL_TRANSFORM | WORLD_TRANSFORM;
const UPDATE_RENDER_DATA = 1 << FlagOfset++;
const OPACITY = 1 << FlagOfset++;
const COLOR = 1 << FlagOfset++;
const OPACITY_COLOR = OPACITY | COLOR;
const RENDER = 1 << FlagOfset++;
const CHILDREN = 1 << FlagOfset++;
const POST_RENDER = 1 << FlagOfset++;
const FINAL = 1 << FlagOfset++;

let _batcher, _forward;
let _cullingMask = 0;

function RenderFlow () {
    this._func = init;
    this._next = null;
}

/* 第 5 步 | engine/2.4.15engine/cocos2d/core/renderer/render-flow.js:169-185 */
function getFlow (flag) {
    let flow = null;
    let tFlag = FINAL;
    while (tFlag > 0) {
        if (tFlag & flag)
            flow = createFlow(tFlag, flow);
        tFlag = tFlag >> 1;
    }
    return flow;
}

//
function init (node) {
    let flag = node._renderFlag;
    let r = flows[flag] = getFlow(flag);
    r._func(node);
}

/* 第 6 步 | engine/2.4.15engine/cocos2d/core/renderer/render-flow.js:85-115 */
_proto._children = function (node) {
    let cullingMask = _cullingMask;
    let batcher = _batcher;

    let parentOpacity = batcher.parentOpacity;
    let opacity = (batcher.parentOpacity *= (node._opacity / 255));

    let worldTransformFlag = batcher.worldMatDirty ? WORLD_TRANSFORM : 0;
    let worldOpacityFlag = batcher.parentOpacityDirty ? OPACITY_COLOR : 0;
    let worldDirtyFlag = worldTransformFlag | worldOpacityFlag;

    let children = node._children;
    for (let i = 0, l = children.length; i < l; i++) {
        let c = children[i];

        // Advance the modification of the flag to avoid node attribute modification is invalid when opacity === 0.
        c._renderFlag |= worldDirtyFlag;
        if (!c._activeInHierarchy || c._opacity === 0) continue;

        _cullingMask = c._cullingMask = c.groupIndex === 0 ? cullingMask : 1 << c.groupIndex;

        // TODO: Maybe has better way to implement cascade opacity
        let colorVal = c._color._val;
        c._color._fastSetA(c._opacity * opacity);
        flows[c._renderFlag]._func(c);
        c._color._val = colorVal;
    }

    batcher.parentOpacity = parentOpacity;

    this._next._func(node);

/* 第 7 步 | engine/2.4.15engine/cocos2d/core/renderer/render-flow.js:29-57 */
_proto._localTransform = function (node) {
    node._updateLocalMatrix();
    node._renderFlag &= ~LOCAL_TRANSFORM;
    this._next._func(node);
};

_proto._worldTransform = function (node) {
    _batcher.worldMatDirty ++;

    let t = node._matrix;
    let trs = node._trs;
    let tm = t.m;
    tm[12] = trs[0];
    tm[13] = trs[1];
    tm[14] = trs[2];

    node._mulMat(node._worldMatrix, node._parent._worldMatrix, t);
    node._renderFlag &= ~WORLD_TRANSFORM;
    this._next._func(node);

    _batcher.worldMatDirty --;
};

_proto._updateRenderData = function (node) {
    let comp = node._renderComponent;
    comp._assembler.updateRenderData(comp);
    node._renderFlag &= ~UPDATE_RENDER_DATA;
    this._next._func(node);
};

/* 第 8 步 | engine/2.4.15engine/cocos2d/core/renderer/render-flow.js:78-83 */
_proto._render = function (node) {
    let comp = node._renderComponent;
    comp._checkBacth(_batcher, node._cullingMask);
    comp._assembler.fillBuffers(comp, _batcher);
    this._next._func(node);
};

