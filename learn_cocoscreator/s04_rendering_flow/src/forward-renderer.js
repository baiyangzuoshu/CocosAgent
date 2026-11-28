/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 11 步 | engine/2.4.15engine/cocos2d/renderer/renderers/forward-renderer.js:57-87 */
  render (scene, dt) {
    this.reset();

    if (!CC_EDITOR) {
      if (dt) {
        this._time[0] += dt;
        this._time[1] = dt;
        this._time[2] ++;
      }
      this._device.setUniform('cc_time', this._time);
    }

    this._updateLights(scene);

    const canvas = this._device._gl.canvas;
    for (let i = 0; i < scene._cameras.length; ++i) {
      let view = this._requestView();
      let width = canvas.width;
      let height = canvas.height;
      let camera = scene._cameras.data[i];
      camera.extractView(view, width, height);
    }

    // render by cameras
    this._viewPools.sort(sortView);

    for (let i = 0; i < this._viewPools.length; ++i) {
      let view = this._viewPools.data[i];
      this._render(view, scene);
    }
  }

/* 第 13 步 | engine/2.4.15engine/cocos2d/renderer/renderers/forward-renderer.js:270-306 */
  _drawItems (view, items) {
    let shadowLights = this._shadowLights;
    if (shadowLights.length === 0 && this._numLights === 0) {
      for (let i = 0; i < items.length; ++i) {
        let item = items.data[i];
        this._draw(item);
      }
    }
    else {
      for (let i = 0; i < items.length; ++i) {
        let item = items.data[i];

        for (let shadowIdx = 0; shadowIdx < shadowLights.length; ++shadowIdx) {
          this._device.setTexture('cc_shadow_map_'+shadowIdx, shadowLights[shadowIdx].shadowMap, this._allocTextureUnit());
        }

        this._draw(item);
      }
    }
  }

  _opaqueStage (view, items) {
    view.getPosition(_camPos);

    // update uniforms
    this._device.setUniform('cc_matView', Mat4.toArray(_a16_view, view._matView));
    this._device.setUniform('cc_matViewInv', Mat4.toArray(_a16_view_inv, view._matViewInv));
    this._device.setUniform('cc_matProj', Mat4.toArray(_a16_proj, view._matProj));
    this._device.setUniform('cc_matViewProj', Mat4.toArray(_a16_viewProj, view._matViewProj));
    this._device.setUniform('cc_cameraPos', Vec4.toArray(_a4_camPos, _camPos));

    // update rendering
    this._submitLightsUniforms();
    this._submitOtherStagesUniforms();

    this._drawItems(view, items);
  }

