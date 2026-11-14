# 第 101 课：自定义 Effect 接到 Sprite

**本课问题：** Sprite 的顶点和纹理如何经过 Material、Effect、Renderer，最后交给 WebGL？

## 读代码顺序

从 `src/main.ts` 开始：它建立一个带位置、UV、顶点色和贴图的 Sprite，再把它交给 Renderer。

~~~text
CCSprite 数据 → CCMaterial/CCEffectAsset → BaseRenderer
  → WebGLDevice 编译/链接 → 设置属性、Uniform、纹理 → drawArrays
~~~

- `CCSprite.ts` 保存本课的 quad 顶点和纹理。
- `CCEffectAsset.ts` 提供 vertex/fragment 两段 Shader 源码。
- `CCMaterial.ts` 持有 Effect 和 `u_tint` 参数。
- `base-renderer.ts` 把材质和 Sprite 数据交给 Device。
- `gfx/device.ts` 建立 WebGL 1 程序并完成绘制。

## 本课输入到画面

Sprite 提供 6 个三角形顶点、UV、顶点色和单位矩阵；2×2 棋盘贴图由 u_texture 提供。Effect 的顶点段计算 MVP 并传出 UV/颜色；片元段计算 texture × vertexColor × u_tint。Material 保存 Effect 和 u_tint=(0.45,0.9,1,1)，Renderer 再把 Sprite/Material 交给 Device。画面应是被青色调制的棋盘 Sprite；若空白，按输出检查编译、属性名、纹理、Uniform 和 draw。

## 对照 Creator 2.4.15 源码

- [`CCSprite.js`](../../engine/2.4.15engine/cocos2d/core/components/CCSprite.js) 与 [`assemblers/sprite/index.js`](../../engine/2.4.15engine/cocos2d/core/renderer/webgl/assemblers/sprite/index.js)：Sprite 和顶点数据入口。
- [`base-renderer.js`](../../engine/2.4.15engine/cocos2d/renderer/core/base-renderer.js)：准备 Pass、程序、属性和绘制调用。
- [`forward-renderer.js`](../../engine/2.4.15engine/cocos2d/renderer/renderers/forward-renderer.js)：遍历当前渲染阶段。
- [`device.js`](../../engine/2.4.15engine/cocos2d/renderer/gfx/device.js)：WebGL 1 程序和 draw 接口。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布使用本机浏览器的 WebGL 1 编译 Shader 并绘制纹理 Sprite；源码是独立职责模型，不是 Creator 引擎运行实例。若画布为空，依次检查 Shader 编译日志、属性名、纹理采样器、Uniform、Blend 和 drawArrays。
