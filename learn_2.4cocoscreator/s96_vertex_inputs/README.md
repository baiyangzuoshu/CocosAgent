# 第 96 课：顶点输入与坐标变换

**本课问题：** 位置、UV、顶点色如何经过矩阵变成裁剪空间位置？

## 读代码顺序

先看 `src/main.ts`：它建立 WebGL 1 上下文、组织样例输入并发起本课操作。再看下面的模块，最后回到引擎源码核对本版实现。

`vertex-layout.ts` 保存位置/UV/顶点色输入；Shader 将位置乘以 `u_mvp`，UV 与颜色作为 varying 输出。

## 课程代码位置

- `src/main.ts`：浏览器入口与调用顺序。
- `src/cocos2d/renderer/gfx/device.ts`：实际 WebGL 1 编译、属性输入、Uniform、纹理与 drawArrays。
- `src/cocos/` 或 `src/cocos2d/` 下的本课模块：按本版引擎职责拆分；样例逻辑是课程独立实现。

## 本课输入到画面

顶点数组有三个位置：(-0.7,-0.6)、(0.7,-0.6)、(0,0.7)；UV 分别为 (0,0)、(1,0)、(0.5,1)，颜色分别为红、绿、蓝倾向。u_mvp 的 x 平移是 0.2，所以第一个顶点从 x=-0.7 变成裁剪坐标 x=-0.5。顶点 Shader 同时把 UV 和颜色写入 varying；本课片元 Shader只显示插值颜色，UV 虽然传过去但暂未采样。画面应是带颜色渐变的三角形。

## 对照本版引擎源码

- [`cocos2d/renderer/build/chunks/shader/unlit-vs.inc`](../../engine/2.4.15engine/cocos2d/renderer/build/chunks/shader/unlit-vs.inc)
- [`cocos2d/renderer/build/chunks/transform.inc`](../../engine/2.4.15engine/cocos2d/renderer/build/chunks/transform.inc)
- [`cocos2d/renderer/core/pass.js`](../../engine/2.4.15engine/cocos2d/renderer/core/pass.js)

版本要点：**Creator 2.4.15** 的课程目标是浏览器 WebGL 1。不把另一版的 Effect 语法、Shader API 或设备路径套进来。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行真实 WebGL Shader 编译和绘制；页面日志显示本课职责顺序。这是独立 WebGL 演示，不启动 Creator Editor/引擎。它只保留本课所需职责，未覆盖完整 Effect 语法、资源导入、Batcher 与 GFX 状态管理。

本课独立运行，不依赖前课目录。下一课：插值、纹理采样与片元颜色。
