# 第 96 课：顶点输入与坐标变换

**本课问题：** 位置、UV、顶点色如何经过矩阵变成裁剪空间位置？

## 读代码顺序

从 `src/main.ts` 开始：建立 WebGL2 上下文、组织本课输入并发起绘制。然后读本课职责模块：`vertex-layout.ts` 保存位置、UV、顶点色；顶点 Shader 使用 `cc-local.chunk` 对应的矩阵职责生成裁剪空间位置。

- `src/cocos/gfx/webgl2/webgl2-device.ts`：真实浏览器 WebGL2 Shader 编译、属性、Uniform、纹理和绘制。
- `src/main.ts`：独立运行入口。
- `src/cocos/`：按 Creator 3.8 源码职责拆分的课程模型。

## 本课输入到画面

顶点数组有三个位置：(-0.7,-0.6)、(0.7,-0.6)、(0,0.7)；UV 分别为 (0,0)、(1,0)、(0.5,1)，颜色分别为红、绿、蓝倾向。u_mvp 的 x 平移是 0.2，所以第一个顶点从 x=-0.7 变成裁剪坐标 x=-0.5。顶点 Shader 把 UV 和颜色写入 out varying；本课片元 Shader只显示插值颜色，UV 虽然传过去但暂未采样。画面应是带颜色渐变的三角形。

## 对照 Creator 3.8.7 源码

- [`editor/assets/effects/for2d/builtin-sprite.effect`](../../engine/3.8.7engine/editor/assets/effects/for2d/builtin-sprite.effect)
- [`editor/assets/chunks/builtin/uniforms/cc-local.chunk`](../../engine/3.8.7engine/editor/assets/chunks/builtin/uniforms/cc-local.chunk)
- [`cocos/render-scene/core/program-utils.ts`](../../engine/3.8.7engine/cocos/render-scene/core/program-utils.ts)

这课只走 Creator 3.8.7 的 WebGL2 路径；不把 Creator 2.4 的 WebGL1 Shader 语法和 3.8 的 Effect 格式混在一起。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行 WebGL2 编译与绘制，日志说明调用顺序。课程使用 Creator 3.8 的 WebGL2 GLSL 写法；原生或 WebGPU 后端不属于浏览器运行证据。 课程不启动 Creator Editor 或完整引擎，省略资产导入、Effect YAML 全语法和完整 GFX 状态。

下一课：插值、纹理采样与片元颜色。
