/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 12 步 | engine/2.4.15engine/cocos2d/renderer/core/base-renderer.js:157-226 */
  _render (view, scene) {
    const device = this._device;

    // setup framebuffer
    device.setFrameBuffer(view._framebuffer);

    // setup viewport
    device.setViewport(
      view._rect.x,
      view._rect.y,
      view._rect.w,
      view._rect.h
    );

    // setup clear
    let clearOpts = {};
    if (view._clearFlags & enums.CLEAR_COLOR) {
      clearOpts.color = Vec4.toArray([], view._color);
    }
    if (view._clearFlags & enums.CLEAR_DEPTH) {
      clearOpts.depth = view._depth;
    }
    if (view._clearFlags & enums.CLEAR_STENCIL) {
      clearOpts.stencil = view._stencil;
    }
    device.clear(clearOpts);

    // get all draw items
    this._drawItemsPools.reset();

    for (let i = 0; i < scene._models.length; ++i) {
      let model = scene._models.data[i];

      // filter model by view
      if ((model._cullingMask & view._cullingMask) === 0) {
        continue;
      }

      let drawItem = this._drawItemsPools.add();
      model.extractDrawItem(drawItem);
    }

    // dispatch draw items to different stage
    _stageInfos.reset();

    for (let i = 0; i < view._stages.length; ++i) {
      let stage = view._stages[i];
      let stageItems = this._stageItemsPools.add();
      stageItems.reset();

      for (let j = 0; j < this._drawItemsPools.length; ++j) {
        let drawItem = this._drawItemsPools.data[j];
        let passes = drawItem.effect.stagePasses[stage];
        if (!passes || passes.length === 0) continue;

        let stageItem = stageItems.add();
        stageItem.passes = passes;
        stageItem.model = drawItem.model;
        stageItem.node = drawItem.node;
        stageItem.ia = drawItem.ia;
        stageItem.effect = drawItem.effect;
        stageItem.defines = drawItem.defines;
        stageItem.sortKey = -1;
        stageItem.uniforms = drawItem.uniforms;
      }

      let stageInfo = _stageInfos.add();
      stageInfo.stage = stage;
      stageInfo.items = stageItems;
    }

/* 第 13 步 | engine/2.4.15engine/cocos2d/renderer/core/base-renderer.js:280-348 */
  _draw (item) {
    const device = this._device;
    const programLib = this._programLib;
    const { node, ia, passes, effect } = item;

    // reset the pool
    // NOTE: we can use drawCounter optimize this
    // TODO: should be configurable
    _float2_pool.reset();
    _float3_pool.reset();
    _float4_pool.reset();
    _float9_pool.reset();
    _float16_pool.reset();
    _float64_pool.reset();
    _int2_pool.reset();
    _int3_pool.reset();
    _int4_pool.reset();
    _int64_pool.reset();

    // set common uniforms
    // TODO: try commit this depends on effect
    // {
    node.getWorldMatrix(_m4_tmp);
    device.setUniform('cc_matWorld', Mat4.toArray(_float16_pool.add(), _m4_tmp));

    // let wq = node.getWorldRotation(cc.quat());
    Mat4.invert(_m4_tmp, _m4_tmp);
    Mat4.transpose(_m4_tmp, _m4_tmp);
    device.setUniform('cc_matWorldIT', Mat4.toArray(_float16_pool.add(), _m4_tmp));
    // }

    let defines = this._defines;

    // for each pass
    for (let i = 0; i < passes.length; ++i) {
      let pass = passes[i];

      if (this._definesChanged) {
        pass._programKey = null;
      }

      let count = ia.count;

      // set vertex buffer
      if (ia._vertexBuffer) {
        device.setVertexBuffer(0, ia._vertexBuffer);
      }

      // set index buffer
      if (ia._indexBuffer) {
        device.setIndexBuffer(ia._indexBuffer);
      }

      // set primitive type
      device.setPrimitiveType(ia._primitiveType);

      // set program
      Object.setPrototypeOf(defines, pass._defines);

      let program = programLib.getProgram(pass, defines, effect.name);
      device.setProgram(program);

      let uniforms = program._uniforms;
      let variants = pass._properties;
      for (let j = 0; j < uniforms.length; j++) {
        let prop = variants[uniforms[j].name];
        if (prop !== undefined)
        this._setProperty(prop);
      }

/* 第 13 步 | engine/2.4.15engine/cocos2d/renderer/core/base-renderer.js:351-414 */
      // cull mode
      device.setCullMode(pass._cullMode);

      // blend
      if (pass._blend) {
        device.enableBlend();
        device.setBlendFuncSep(
          pass._blendSrc,
          pass._blendDst,
          pass._blendSrcAlpha,
          pass._blendDstAlpha
        );
        device.setBlendEqSep(
          pass._blendEq,
          pass._blendAlphaEq
        );
        device.setBlendColor32(pass._blendColor);
      }

      // depth test & write
      if (pass._depthTest) {
        device.enableDepthTest();
        device.setDepthFunc(pass._depthFunc);
      }
      if (pass._depthWrite) {
        device.enableDepthWrite();
      }

      // stencil
      device.setStencilTest(pass._stencilTest);
      if (pass._stencilTest === gfx.STENCIL_ENABLE) {
        // front
        device.setStencilFuncFront(
          pass._stencilFuncFront,
          pass._stencilRefFront,
          pass._stencilMaskFront
        );
        device.setStencilOpFront(
          pass._stencilFailOpFront,
          pass._stencilZFailOpFront,
          pass._stencilZPassOpFront,
          pass._stencilWriteMaskFront
        );

        // back
        device.setStencilFuncBack(
          pass._stencilFuncBack,
          pass._stencilRefBack,
          pass._stencilMaskBack
        );
        device.setStencilOpBack(
          pass._stencilFailOpBack,
          pass._stencilZFailOpBack,
          pass._stencilZPassOpBack,
          pass._stencilWriteMaskBack
        );
      }

      // draw pass
      device.draw(ia._start, count);

      this._resetTextuerUnit();
    }
  }

