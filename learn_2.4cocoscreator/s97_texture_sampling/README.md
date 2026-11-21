# 第 97 课：插值、纹理采样与片元颜色

**本课问题：** 顶点数据怎样插值到片元，纹理采样怎样形成像素？

## 读代码顺序

先看 `src/main.ts`：它建立 WebGL 1 上下文、组织样例输入并发起本课操作。再看下面的模块，最后回到引擎源码核对本版实现。

`texture.ts` 保存顶点 UV 与 2×2 测试贴图；顶点阶段输出 UV，光栅化插值后片元阶段采样。

## 课程代码位置

- `src/main.ts`：浏览器入口与调用顺序。
- `src/cocos2d/renderer/gfx/device.ts`：实际 WebGL 1 编译、属性输入、Uniform、纹理与 drawArrays。
- `src/cocos/` 或 `src/cocos2d/` 下的本课模块：按本版引擎职责拆分；样例逻辑是课程独立实现。

## 本课输入到画面

quad 是两个三角形组成的矩形，UV 从左下 (0,0) 到右上 (1,1)。checkerTexture 是 2×2 RGBA 贴图，四格颜色依次为红、绿、蓝、白。顶点 Shader 将 UV 写入 v_uv；光栅化会在每个片元插值 v_uv；片元 Shader 用 texture2D(u_texture,v_uv) 取颜色。画面应显示四格棋盘，能看到从 UV 到贴图采样的完整路径。

## 对照本版引擎源码

- [`cocos2d/renderer/build/chunks/shader/unlit-fs.inc`](../../engine/2.4.15engine/cocos2d/renderer/build/chunks/shader/unlit-fs.inc)
- [`cocos2d/renderer/build/chunks/texture.inc`](../../engine/2.4.15engine/cocos2d/renderer/build/chunks/texture.inc)
- [`cocos2d/renderer/build/chunks/output.inc`](../../engine/2.4.15engine/cocos2d/renderer/build/chunks/output.inc)

版本要点：**Creator 2.4.15** 的课程目标是浏览器 WebGL 1。不把另一版的 Effect 语法、Shader API 或设备路径套进来。

## 为什么这样设计

UV 作为顶点 varying 在光栅化阶段插值，片元 Shader 再按插值坐标采样 Texture。把插值与采样分开可以判断纹理方向、过滤或颜色错误出在哪一段。

## 源码流程图

```mermaid
flowchart TD
 A[Vertex UV] --> B[vertex shader varying v_uv]
 B --> C[Rasterizer interpolates v_uv]
 D[Texture upload + sampler state] --> E[texture2D(u_texture, v_uv)]
 C --> E
 E --> F[fragment color]
 F --> G[framebuffer pixel]
```

## 本课必须保留的机制

保留 UV 随顶点输出、光栅化在片元间插值 `v_uv`、片元 Shader 用 `texture2D(u_texture, v_uv)` 采样纹理并输出颜色。

## 最小观察宿主

浏览器 WebGL 1 绘制带 2×2 棋盘贴图的 quad，对照每格颜色观察 UV 到采样结果的路径。

## 模型化简化与 Creator Runtime 边界

贴图与顶点输入是固定教学数据，Device/Shader 为独立实现；不运行 Creator 的 SpriteFrame、AssetManager、Renderer 或完整材质/纹理状态管理。画面是真实 WebGL 输出，但不是 Creator Runtime 输出。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行真实 WebGL Shader 编译和绘制；页面日志显示本课职责顺序。这是独立 WebGL 演示，不启动 Creator Editor/引擎。它只保留本课所需职责，未覆盖完整 Effect 语法、资源导入、Batcher 与 GFX 状态管理。

本课独立运行，不依赖前课目录。下一课：自定义 Uniform 与材质参数。
