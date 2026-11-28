/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 8 步 | engine/2.4.15engine/cocos2d/core/components/CCRenderComponent.js:245-255 */
    _checkBacth (renderer, cullingMask) {
        let material = this._materials[0];
        if ((material && material.getHash() !== renderer.material.getHash()) ||
            renderer.cullingMask !== cullingMask) {
            renderer._flush();

            renderer.node = material.getDefine('CC_USE_MODEL') ? this.node : renderer._dummyNode;
            renderer.material = material;
            renderer.cullingMask = cullingMask;
        }
    }

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/components/CCRenderComponent.js:84-92 */
    _resetAssembler () {
        Assembler.init(this);
        this._updateColor();
        this.setVertsDirty();
    },

    __preload () {
        this._resetAssembler();
        this._activateMaterial();

