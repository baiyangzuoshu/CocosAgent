/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 初始化接线 | engine/2.4.15engine/cocos2d/core/renderer/index.js:76-85 */
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

/* 第 2 步 | engine/2.4.15engine/cocos2d/core/renderer/index.js:126-133 */
    render (ecScene, dt) {
        this.device.resetDrawCalls();
        if (ecScene) {
            // walk entity component scene to generate models
            this._flow.render(ecScene, dt);
            this.drawCalls = this.device.getDrawCalls();
        }
    },

