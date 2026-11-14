# 第 99 课：Alpha、预乘色与混合

**本课问题：** Shader 输出的透明颜色怎样和背景混合？

## 读代码顺序

从 `src/main.ts` 开始：建立 WebGL2 上下文、组织本课输入并发起绘制。然后读本课职责模块：`blend-state.ts` 描述预乘 Alpha 混合；两个半透明图元重叠，并使用 `ONE / ONE_MINUS_SRC_ALPHA`。

- `src/cocos/gfx/webgl2/webgl2-device.ts`：真实浏览器 WebGL2 Shader 编译、属性、Uniform、纹理和绘制。
- `src/main.ts`：独立运行入口。
- `src/cocos/`：按 Creator 3.8 源码职责拆分的课程模型。

## 本课输入到画面

本课在同一画布绘制蓝色和橙色两个半透明矩形，它们在中间重叠。片元 Shader 先计算 rgb×alpha；Pass Blend 状态使用 ONE / ONE_MINUS_SRC_ALPHA，表示源 RGB 已经预乘过。对照输出图的单色区和重叠区：颜色混合来自 Blend 阶段，单靠 Shader 的 fragColor 不能解释最终屏幕颜色。

## 对照 Creator 3.8.7 源码

- [`editor/assets/effects/for2d/builtin-sprite.effect`](../../engine/3.8.7engine/editor/assets/effects/for2d/builtin-sprite.effect)
- [`cocos/render-scene/core/pass.ts`](../../engine/3.8.7engine/cocos/render-scene/core/pass.ts)
- [`editor/assets/effects/builtin-unlit.effect`](../../engine/3.8.7engine/editor/assets/effects/builtin-unlit.effect)

这课只走 Creator 3.8.7 的 WebGL2 路径；不把 Creator 2.4 的 WebGL1 Shader 语法和 3.8 的 Effect 格式混在一起。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行 WebGL2 编译与绘制，日志说明调用顺序。预乘 Alpha 要同时匹配 Shader 输出和 Pass BlendState；换成直通 Alpha 时应改为 `SRC_ALPHA / ONE_MINUS_SRC_ALPHA`。 课程不启动 Creator Editor 或完整引擎，省略资产导入、Effect YAML 全语法和完整 GFX 状态。

下一课：宏变体与平台边界。
