
import gfx from '../../renderer/gfx';

import InputAssembler from '../../renderer/core/input-assembler';
import Pass from '../../renderer/core/pass';

// const RenderFlow = require('./render-flow');

function _initBuiltins(device) {
    let defaultTexture = new gfx.Texture2D(device, {
        images: [],
        width: 128,
        height: 128,
        wrapS: gfx.WRAP_REPEAT,
        wrapT: gfx.WRAP_REPEAT,
        format: gfx.TEXTURE_FMT_RGB8,
        genMipmaps: false,
    });

    return {
        defaultTexture: defaultTexture,
        programTemplates: [],
        programChunks: {},
    };
}

/**
 * @module cc
 */

/**
 * !#en The renderer object which provide access to render system APIs, 
 * detailed APIs will be available progressively.
 * !#zh 提供基础渲染接口的渲染器对象，渲染层的基础接口将逐步开放给用户
 * @class renderer
 * @static
 */
export default cc.renderer = {
    Texture2D: null,

    InputAssembler: InputAssembler,
    Pass: Pass,

    renderEngine: null,

    canvas: null,
   
    device: null,
    scene: null,
    
    drawCalls: 0,
    // Render component handler
    _handle: null,
    _cameraNode: null,
    _camera: null,
    _forward: null,
    _flow: null,

    initWebGL (canvas, opts) {
        require('./webgl/assemblers');
        const ModelBatcher = require('./webgl/model-batcher');

        this.Texture2D = gfx.Texture2D;
        this.canvas = canvas;
        this._flow = cc.RenderFlow;
        
        if (CC_JSB && CC_NATIVERENDERER) {
            // native codes will create an instance of Device, so just use the global instance.
            this.device = gfx.Device.getInstance();
            this.scene = new renderer.Scene();
            let builtins = _initBuiltins(this.device);
            this._forward = new renderer.ForwardRenderer(this.device, builtins);
            let nativeFlow = new renderer.RenderFlow(this.device, this.scene, this._forward);
            this._flow.init(nativeFlow);
        }
        else {
            let Scene = require('../../renderer/scene/scene');
            let ForwardRenderer = require('../../renderer/renderers/forward-renderer');
            this.device = new gfx.Device(canvas, opts);
            this.scene = new Scene();
            let builtins = _initBuiltins(this.device);
            this._forward = new ForwardRenderer(this.device, builtins);
            this._handle = new ModelBatcher(this.device, this.scene);
            this._flow.init(this._handle, this._forward);
        }
    },

    initCanvas (canvas) {
        const canvasRenderer = require('./canvas');
        const Texture2D = require('./canvas/Texture2D');
        const Device = require('./canvas/Device');

        // It's actually running with original render engine
        this.Device = Device;

        this.Texture2D = Texture2D;

        this.canvas = canvas;
        this.device = new Device(canvas);
        this._camera = {
            a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0
        };
        this._handle = new canvasRenderer.RenderComponentHandle(this.device, this._camera);
        this._forward = new canvasRenderer.ForwardRenderer();
        this._flow = cc.RenderFlow;
        this._flow.init(this._handle, this._forward);
    },

    updateCameraViewport () {
        // TODO: remove HACK
        if (!CC_EDITOR && cc.director) {
            let ecScene = cc.director.getScene();
            if (ecScene) ecScene.setScale(1, 1, 1);
        }

        if (cc.game.renderType === cc.game.RENDER_TYPE_CANVAS) {
            let vp = cc.view.getViewportRect();
            this.device.setViewport(vp.x, vp.y, vp.width, vp.height);
            this._camera.a = cc.view.getScaleX();
            this._camera.d = cc.view.getScaleY();
            this._camera.tx = vp.x;
            this._camera.ty = vp.y + vp.height;
        }
    },

    render (ecScene, dt) {
        this.device.resetDrawCalls();
        if (ecScene) {
            // walk entity component scene to generate models
            this._flow.render(ecScene, dt);
            this.drawCalls = this.device.getDrawCalls();
        }
    },

    clear () {
        this._handle.reset();
        this._forward.clear();
    }
};
