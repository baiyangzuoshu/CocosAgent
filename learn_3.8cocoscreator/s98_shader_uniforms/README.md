# 第 98 课：自定义 Uniform 与材质参数

**本课问题：** 材质参数如何在绘制时变成 Shader Uniform？

## 读代码顺序

从 `src/main.ts` 开始：建立 WebGL2 上下文、组织本课输入并发起绘制。然后读本课职责模块：`Pass` 保存材质 Uniform；同一程序分别绘制两块区域，改变 `u_tint` 后颜色不同。

- `src/cocos/gfx/webgl2/webgl2-device.ts`：真实浏览器 WebGL2 Shader 编译、属性、Uniform、纹理和绘制。
- `src/main.ts`：独立运行入口。
- `src/cocos/`：按 Creator 3.8 源码职责拆分的课程模型。

## 本课输入到画面

屏幕左右各有一个 quad，两个 draw 调用共用同一 WebGLProgram。第一次 Pass 中 u_tint=(0.2,0.75,1,1)，第二次将它改为 (1,0.45,0.18,1)。片元 Shader 直接输出 u_tint，因此左边是蓝青色，右边是橙色。重点看调用顺序：Pass 保存参数 → device.draw() 把参数传给 WebGL Device → WebGL 用 uniform4fv 更新当前程序。

## 对照 Creator 3.8.7 源码

- [`cocos/render-scene/core/pass.ts`](../../engine/3.8.7engine/cocos/render-scene/core/pass.ts)
- [`cocos/render-scene/core/pass-instance.ts`](../../engine/3.8.7engine/cocos/render-scene/core/pass-instance.ts)
- [`cocos/render-scene/core/material-instance.ts`](../../engine/3.8.7engine/cocos/render-scene/core/material-instance.ts)
- [`cocos/render-scene/core/program-lib.ts`](../../engine/3.8.7engine/cocos/render-scene/core/program-lib.ts)

这课只走 Creator 3.8.7 的 WebGL2 路径；不把 Creator 2.4 的 WebGL1 Shader 语法和 3.8 的 Effect 格式混在一起。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行 WebGL2 编译与绘制，日志说明调用顺序。课程使用 Creator 3.8 的 WebGL2 GLSL 写法；原生或 WebGPU 后端不属于浏览器运行证据。 课程不启动 Creator Editor 或完整引擎，省略资产导入、Effect YAML 全语法和完整 GFX 状态。

下一课：Alpha、预乘色与混合。
