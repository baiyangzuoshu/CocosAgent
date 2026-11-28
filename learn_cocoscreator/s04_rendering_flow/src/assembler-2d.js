/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/renderer/assembler-2d.js:100-127 */
    fillBuffers (comp, renderer) {
        if (renderer.worldMatDirty) {
            this.updateWorldVerts(comp);
        }

        let renderData = this._renderData;
        let vData = renderData.vDatas[0];
        let iData = renderData.iDatas[0];

        let buffer = this.getBuffer(renderer);
        let offsetInfo = buffer.request(this.verticesCount, this.indicesCount);

        // buffer data may be realloc, need get reference after request.

        // fill vertices
        let vertexOffset = offsetInfo.byteOffset >> 2,
            vbuf = buffer._vData;

        if (vData.length + vertexOffset > vbuf.length) {
            vbuf.set(vData.subarray(0, vbuf.length - vertexOffset), vertexOffset);
        } else {
            vbuf.set(vData, vertexOffset);
        }

        // fill indices
        let ibuf = buffer._iData,
            indiceOffset = offsetInfo.indiceOffset,
            vertexId = offsetInfo.vertexOffset;

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/renderer/assembler-2d.js:131-134 */
        for (let i = 0, l = Math.min(this.indicesCount, iData.length); i < l; i++) {
            ibuf[indiceOffset++] = vertexId + iData[i];
        }
    }

