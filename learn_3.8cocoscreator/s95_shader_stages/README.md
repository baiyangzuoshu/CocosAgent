# 第 95 课：Shader 源码与阶段

**本课问题：** Effect 中的顶点与片元入口如何组成一个程序？

## 读代码顺序

从 `src/main.ts` 开始：建立 WebGL2 上下文、组织本课输入并发起绘制。然后读本课职责模块：`EffectAsset` 样例接收 Pass 的 vert/frag 两段 GLSL；WebGL2 Device 分别编译后链接。

- `src/cocos/gfx/webgl2/webgl2-device.ts`：真实浏览器 WebGL2 Shader 编译、属性、Uniform、纹理和绘制。
- `src/main.ts`：独立运行入口。
- `src/cocos/`：按 Creator 3.8 源码职责拆分的课程模型。

## 本课输入到画面

main.ts 创建 WebGL 2 上下文，输入一个三角形的三个二维顶点。EffectAsset.selectProgram() 选出 Effect 的 vertex 与 fragment 源码；WebGL2 Device 分别编译两段并链接。顶点 Shader 把 a_position 写入 gl_Position；片元 Shader 固定输出青蓝色。运行后应看到一个青蓝色三角形。本课输入是两段 Shader 源码，输出是 WebGLProgram。注意 GLSL ES 3.00 使用 in/out，并显式声明片元输出 fragColor。

## 对照 Creator 3.8.7 源码

- [`editor/assets/effects/for2d/builtin-sprite.effect`](../../engine/3.8.7engine/editor/assets/effects/for2d/builtin-sprite.effect)
- [`editor/assets/effects/builtin-unlit.effect`](../../engine/3.8.7engine/editor/assets/effects/builtin-unlit.effect)
- [`cocos/render-scene/core/program-utils.ts`](../../engine/3.8.7engine/cocos/render-scene/core/program-utils.ts)

这课只走 Creator 3.8.7 的 WebGL2 路径；不把 Creator 2.4 的 WebGL1 Shader 语法和 3.8 的 Effect 格式混在一起。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行 WebGL2 编译与绘制，日志说明调用顺序。课程使用 Creator 3.8 的 WebGL2 GLSL 写法；原生或 WebGPU 后端不属于浏览器运行证据。 课程不启动 Creator Editor 或完整引擎，省略资产导入、Effect YAML 全语法和完整 GFX 状态。

下一课：顶点输入与坐标变换。
