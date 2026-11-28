/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 10 步 | engine/2.4.15engine/cocos2d/core/renderer/webgl/mesh-buffer.js:89-105 */
    uploadData () {
        if (this.byteOffset === 0 || !this._dirty) {
            return;
        }

        // update vertext data
        let vertexsData = new Float32Array(this._vData.buffer, 0, this.byteOffset >> 2);
        let indicesData = new Uint16Array(this._iData.buffer, 0, this.indiceOffset);

        let vb = this._vb;
        vb.update(0, vertexsData);

        let ib = this._ib;
        ib.update(0, indicesData);

        this._dirty = false;
    },

/* 第 10 步 | engine/2.4.15engine/cocos2d/core/renderer/webgl/mesh-buffer.js:140-168 */
    checkAndSwitchBuffer (vertexCount) {
        if (this.vertexOffset + vertexCount > 65535) {
            this.uploadData();
            this._batcher._flush();
            this.switchBuffer();
        }
    },

    requestStatic (vertexCount, indiceCount) {

        this.checkAndSwitchBuffer(vertexCount);

        let byteOffset = this.byteOffset + vertexCount * this._vertexBytes;
        let indiceOffset = this.indiceOffset + indiceCount;

        let byteLength = this._vData.byteLength;
        let indiceLength = this._iData.length;
        if (byteOffset > byteLength || indiceOffset > indiceLength) {
            while (byteLength < byteOffset || indiceLength < indiceOffset) {
                this._initVDataCount *= 2;
                this._initIDataCount *= 2;

                byteLength = this._initVDataCount * 4;
                indiceLength = this._initIDataCount;
            }

            this._reallocBuffer();
        }
        this._updateOffset(vertexCount, indiceCount, byteOffset);

/* 第 10 步 | engine/2.4.15engine/cocos2d/core/renderer/webgl/mesh-buffer.js:185-192 */
    request (vertexCount, indiceCount) {
        if (this._batcher._buffer !== this) {
            this._batcher._flush();
            this._batcher._buffer = this;
        }

        this.requestStatic(vertexCount, indiceCount);
        return this._offsetInfo;

