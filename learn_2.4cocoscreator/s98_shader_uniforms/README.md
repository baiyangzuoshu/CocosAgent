# 第 98 课：自定义 Uniform 与材质参数

**本课问题：** 材质参数如何在绘制时变成 Shader Uniform？

## 读代码顺序

先看 `src/main.ts`：它建立 WebGL 1 上下文、组织样例输入并发起本课操作。再看下面的模块，最后回到引擎源码核对本版实现。

`Pass` 保存 Uniform 值；同一个程序对左右两个图元分别设置颜色，观察材质参数不会改写 Shader 源码。

## 课程代码位置

- `src/main.ts`：浏览器入口与调用顺序。
- `src/cocos2d/renderer/gfx/device.ts`：实际 WebGL 1 编译、属性输入、Uniform、纹理与 drawArrays。
- `src/cocos/` 或 `src/cocos2d/` 下的本课模块：按本版引擎职责拆分；样例逻辑是课程独立实现。

## 本课输入到画面

屏幕左右各有一个 quad，两个 draw 调用共用同一 WebGLProgram。第一次 Pass 中 u_tint=(0.2,0.75,1,1)，第二次将它改为 (1,0.45,0.18,1)。片元 Shader 直接输出 u_tint，因此左边是蓝青色，右边是橙色。重点看调用顺序：Pass 保存参数 → device.draw() 把参数传给 WebGL Device → WebGL 用 uniform4fv 更新当前程序。

## 对照本版引擎源码

- [`cocos2d/renderer/core/pass.js`](../../engine/2.4.15engine/cocos2d/renderer/core/pass.js)
- [`cocos2d/renderer/core/base-renderer.js`](../../engine/2.4.15engine/cocos2d/renderer/core/base-renderer.js)
- [`cocos2d/renderer/gfx/device.js`](../../engine/2.4.15engine/cocos2d/renderer/gfx/device.js)

版本要点：**Creator 2.4.15** 的课程目标是浏览器 WebGL 1。不把另一版的 Effect 语法、Shader API 或设备路径套进来。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行真实 WebGL Shader 编译和绘制；页面日志显示本课职责顺序。这是独立 WebGL 演示，不启动 Creator Editor/引擎。它只保留本课所需职责，未覆盖完整 Effect 语法、资源导入、Batcher 与 GFX 状态管理。

本课独立运行，不依赖前课目录。下一课：Alpha、预乘色与混合。
