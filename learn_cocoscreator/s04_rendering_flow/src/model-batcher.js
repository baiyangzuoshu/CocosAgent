/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 10 步 | engine/2.4.15engine/cocos2d/core/renderer/webgl/model-batcher.js:135-164 */
    _flush () {
        let material = this.material,
            buffer = this._buffer,
            indiceCount = buffer.indiceOffset - buffer.indiceStart;
        if (!this.walking || !material || indiceCount <= 0) {
            return;
        }

        let effect = material.effect;
        if (!effect) return;

        // Generate ia
        let ia = this._iaPool.add();
        ia._vertexBuffer = buffer._vb;
        ia._indexBuffer = buffer._ib;
        ia._start = buffer.indiceStart;
        ia._count = indiceCount;

        // Generate model
        let model = this._modelPool.add();
        this._batchedModels.push(model);
        model.sortKey = this._sortKey++;
        model._cullingMask = this.cullingMask;
        model.setNode(this.node);
        model.setEffect(effect);
        model.setInputAssembler(ia);

        this._renderScene.addModel(model);
        buffer.forwardIndiceStartToOffset();
    },

/* 第 10 步 | engine/2.4.15engine/cocos2d/core/renderer/webgl/model-batcher.js:187-200 */
    terminate () {
        if (cc.dynamicAtlasManager && cc.dynamicAtlasManager.enabled) {
            cc.dynamicAtlasManager.update();
        }

        // flush current rest Model
        this._flush();

        for (let key in _buffers) {
            _buffers[key].uploadData();
        }

        this.walking = false;
    },

