# 第 100 课：宏变体与平台边界

**本课问题：** 宏如何选择程序分支，WebGL 版本限制在哪里？

## 读代码顺序

从 `src/main.ts` 开始：建立 WebGL2 上下文、组织本课输入并发起绘制。然后读本课职责模块：`ProgramLib` 把宏和值组成变体键；`#version 300 es` 必须在宏定义之前，两个宏配置分别编译。

- `src/cocos/gfx/webgl2/webgl2-device.ts`：真实浏览器 WebGL2 Shader 编译、属性、Uniform、纹理和绘制。
- `src/main.ts`：独立运行入口。
- `src/cocos/`：按 Creator 3.8 源码职责拆分的课程模型。

## 本课输入到画面

左右两个 quad 使用同一份 Shader 源码，但分别请求 USE_TINT=1 和 USE_TINT=0。ProgramLib 把宏值写入缓存键，并在编译前插入 #define；USE_TINT=1 的分支输出 u_tint，另一分支输出固定橙色。左边因此显示蓝青色，右边显示橙色；两次请求形成两个 WebGLProgram。再用相同宏请求时应命中缓存。页面还会打印浏览器实际 WebGL 2 / GLSL ES 版本。

## 对照 Creator 3.8.7 源码

- [`cocos/render-scene/core/program-lib.ts`](../../engine/3.8.7engine/cocos/render-scene/core/program-lib.ts)
- [`cocos/render-scene/core/program-utils.ts`](../../engine/3.8.7engine/cocos/render-scene/core/program-utils.ts)
- [`cocos/gfx/webgl2/webgl2-shader.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-shader.ts)

这课只走 Creator 3.8.7 的 WebGL2 路径；不把 Creator 2.4 的 WebGL1 Shader 语法和 3.8 的 Effect 格式混在一起。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行 WebGL2 编译与绘制，日志说明调用顺序。课程使用 Creator 3.8 的 WebGL2 GLSL 写法；原生或 WebGPU 后端不属于浏览器运行证据。 课程不启动 Creator Editor 或完整引擎，省略资产导入、Effect YAML 全语法和完整 GFX 状态。

下一课：Sprite 接入与调试。
