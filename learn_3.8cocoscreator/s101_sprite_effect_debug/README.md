# 第 101 课：Sprite 接入与调试

**本课问题：** 自定义 Effect 如何从 Sprite 进入 GPU 绘制？

## 读代码顺序

从 `src/main.ts` 开始：建立 WebGL2 上下文、组织本课输入并发起绘制。然后读本课职责模块：`Sprite` 提供顶点与贴图，`Material` 持有 Effect/Uniform，`Renderer` 调用 WebGL2 Device 绘制。

- `src/cocos/gfx/webgl2/webgl2-device.ts`：真实浏览器 WebGL2 Shader 编译、属性、Uniform、纹理和绘制。
- `src/main.ts`：独立运行入口。
- `src/cocos/`：按 Creator 3.8 源码职责拆分的课程模型。

## 本课输入到画面

Sprite 提供 6 个三角形顶点、UV、顶点色和单位矩阵；2×2 棋盘贴图由 u_texture 提供。Effect 的顶点段计算 MVP 并传出 UV/颜色；片元段计算 texture × vertexColor × u_tint。Material 保存 Effect 和 u_tint=(0.45,0.9,1,1)，Renderer 再把 Sprite/Material 交给 WebGL2 Device。画面应是被青色调制的棋盘 Sprite；若空白，按输出检查编译、属性名、纹理、Uniform 和 draw。

## 对照 Creator 3.8.7 源码

- [`cocos/2d/components/sprite.ts`](../../engine/3.8.7engine/cocos/2d/components/sprite.ts)
- [`cocos/2d/renderer/batcher-2d.ts`](../../engine/3.8.7engine/cocos/2d/renderer/batcher-2d.ts)
- [`cocos/rendering/forward/forward-stage.ts`](../../engine/3.8.7engine/cocos/rendering/forward/forward-stage.ts)
- [`cocos/gfx/webgl2/webgl2-shader.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-shader.ts)

这课只走 Creator 3.8.7 的 WebGL2 路径；不把 Creator 2.4 的 WebGL1 Shader 语法和 3.8 的 Effect 格式混在一起。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行 WebGL2 编译与绘制，日志说明调用顺序。课程使用 Creator 3.8 的 WebGL2 GLSL 写法；原生或 WebGPU 后端不属于浏览器运行证据。 课程不启动 Creator Editor 或完整引擎，省略资产导入、Effect YAML 全语法和完整 GFX 状态。

本课完成本阶段的 Sprite 接入链。
