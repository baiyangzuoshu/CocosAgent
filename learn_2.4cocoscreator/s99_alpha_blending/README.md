# 第 99 课：Alpha、预乘色与混合

**本课问题：** Shader 输出的透明颜色怎样和背景混合？

## 读代码顺序

先看 `src/main.ts`：它建立 WebGL 1 上下文、组织样例输入并发起本课操作。再看下面的模块，最后回到引擎源码核对本版实现。

`blend-state.ts` 描述混合规则；两个半透明图元重叠，Shader 输出预乘颜色，Device 设置对应 BlendFunc。

## 课程代码位置

- `src/main.ts`：浏览器入口与调用顺序。
- `src/cocos2d/renderer/gfx/device.ts`：实际 WebGL 1 编译、属性输入、Uniform、纹理与 drawArrays。
- `src/cocos/` 或 `src/cocos2d/` 下的本课模块：按本版引擎职责拆分；样例逻辑是课程独立实现。

## 本课输入到画面

本课在同一画布绘制蓝色和橙色两个半透明矩形，它们在中间重叠。片元 Shader 先计算 rgb×alpha；Pass Blend 状态使用 ONE / ONE_MINUS_SRC_ALPHA，表示源 RGB 已经预乘过。对照输出图的单色区和重叠区：颜色变暗/混合来自 Blend 阶段，单靠 Shader 的 gl_FragColor 不能解释最终屏幕颜色。

## 对照本版引擎源码

- [`cocos2d/renderer/build/chunks/alpha-test.inc`](../../engine/2.4.15engine/cocos2d/renderer/build/chunks/alpha-test.inc)
- [`cocos2d/renderer/build/chunks/output.inc`](../../engine/2.4.15engine/cocos2d/renderer/build/chunks/output.inc)
- [`cocos2d/renderer/core/pass.js`](../../engine/2.4.15engine/cocos2d/renderer/core/pass.js)

版本要点：**Creator 2.4.15** 的课程目标是浏览器 WebGL 1。不把另一版的 Effect 语法、Shader API 或设备路径套进来。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行真实 WebGL Shader 编译和绘制；页面日志显示本课职责顺序。这是独立 WebGL 演示，不启动 Creator Editor/引擎。它只保留本课所需职责，未覆盖完整 Effect 语法、资源导入、Batcher 与 GFX 状态管理。

本课独立运行，不依赖前课目录。下一课：宏变体与平台边界。
