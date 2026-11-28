/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 14 步 | engine/2.4.15engine/cocos2d/renderer/gfx/device.js:1300-1384 */
  draw(base, count) {
    const gl = this._gl;
    let cur = this._current;
    let next = this._next;

    // commit blend
    _commitBlendStates(gl, cur, next);

    // commit depth
    _commitDepthStates(gl, cur, next);

    // commit stencil
    _commitStencilStates(gl, cur, next);

    // commit cull
    _commitCullMode(gl, cur, next);

    // commit vertex-buffer
    _commitVertexBuffers(this, gl, cur, next);

    // commit index-buffer
    if (cur.indexBuffer !== next.indexBuffer) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, next.indexBuffer && next.indexBuffer._glID !== -1 ? next.indexBuffer._glID : null);
    }

    // commit program
    let programDirty = false;
    if (cur.program !== next.program) {
      if (next.program._linked) {
        gl.useProgram(next.program._glID);
      } else {
        console.warn('Failed to use program: has not linked yet.');
      }
      programDirty = true;
    }

    // commit texture/sampler
    _commitTextures(gl, cur, next);

    // commit uniforms
    for (let i = 0; i < next.program._uniforms.length; ++i) {
      let uniformInfo = next.program._uniforms[i];
      let uniform = this._uniforms[uniformInfo.name];
      if (!uniform) {
        // console.warn(`Can not find uniform ${uniformInfo.name}`);
        continue;
      }

      if (!programDirty && !uniform.dirty) {
        continue;
      }

      uniform.dirty = false;

      // TODO: please consider array uniform: uniformInfo.size > 0

      let commitFunc = (uniformInfo.size === undefined) ? _type2uniformCommit[uniformInfo.type] : _type2uniformArrayCommit[uniformInfo.type];
      if (!commitFunc) {
        console.warn(`Can not find commit function for uniform ${uniformInfo.name}`);
        continue;
      }

      commitFunc(gl, uniformInfo.location, uniform.value);
    }

    if (count) {
      // drawPrimitives
      if (next.indexBuffer) {
        gl.drawElements(
          this._next.primitiveType,
          count,
          next.indexBuffer._format,
          base * next.indexBuffer._bytesPerIndex
        );
      } else {
        gl.drawArrays(
          this._next.primitiveType,
          base,
          count
        );
      }

      // update stats
      this._stats.drawcalls++;
    }

