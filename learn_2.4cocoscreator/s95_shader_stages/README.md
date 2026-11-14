# 第 95 课：Shader 源码与阶段

**本课问题：** Effect 中的顶点与片元入口如何组成一个程序？

## 读代码顺序

先看 `src/main.ts`：它建立 WebGL 1 上下文、组织样例输入并发起本课操作。再看下面的模块，最后回到引擎源码核对本版实现。

`EffectParser` 接收两个阶段的源码，WebGL Device 分别编译，再链接为一个 Program。

## 课程代码位置

- `src/main.ts`：浏览器入口与调用顺序。
- `src/cocos2d/renderer/gfx/device.ts`：实际 WebGL 1 编译、属性输入、Uniform、纹理与 drawArrays。
- `src/cocos/` 或 `src/cocos2d/` 下的本课模块：按本版引擎职责拆分；样例逻辑是课程独立实现。

## 本课输入到画面

main.ts 创建 WebGL 1 上下文，输入一个三角形的三个二维顶点。EffectParser.parse() 把 Effect 中的 vertex 与 fragment 字段拆开；WebGLDevice.createProgram() 再分别编译并链接它们。顶点 Shader 把 a_position 写入 gl_Position；片元 Shader 固定输出青蓝色。运行后应看到一个青蓝色三角形。这一课的输入是两段 Shader 源码，输出是 WebGLProgram。

## 对照本版引擎源码

- [`cocos2d/core/assets/material/effect-parser.ts`](../../engine/2.4.15engine/cocos2d/core/assets/material/effect-parser.ts)
- [`cocos2d/core/assets/material/CCEffectAsset.js`](../../engine/2.4.15engine/cocos2d/core/assets/material/CCEffectAsset.js)
- [`cocos2d/renderer/build/chunks/shader/unlit-vs.inc`](../../engine/2.4.15engine/cocos2d/renderer/build/chunks/shader/unlit-vs.inc)
- [`cocos2d/renderer/build/chunks/shader/unlit-fs.inc`](../../engine/2.4.15engine/cocos2d/renderer/build/chunks/shader/unlit-fs.inc)

版本要点：**Creator 2.4.15** 的课程目标是浏览器 WebGL 1。不把另一版的 Effect 语法、Shader API 或设备路径套进来。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行真实 WebGL Shader 编译和绘制；页面日志显示本课职责顺序。这是独立 WebGL 演示，不启动 Creator Editor/引擎。它只保留本课所需职责，未覆盖完整 Effect 语法、资源导入、Batcher 与 GFX 状态管理。

本课独立运行，不依赖前课目录。下一课：顶点输入与坐标变换。
