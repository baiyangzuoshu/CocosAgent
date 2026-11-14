# 第 97 课：插值、纹理采样与片元颜色

**本课问题：** 顶点数据怎样插值到片元，纹理采样怎样形成像素？

## 读代码顺序

从 `src/main.ts` 开始：建立 WebGL2 上下文、组织本课输入并发起绘制。然后读本课职责模块：`texture-sampler.ts` 保存 UV 和 2×2 贴图；光栅化插值 UV 后，片元 Shader 用 WebGL2 `texture()` 采样。

- `src/cocos/gfx/webgl2/webgl2-device.ts`：真实浏览器 WebGL2 Shader 编译、属性、Uniform、纹理和绘制。
- `src/main.ts`：独立运行入口。
- `src/cocos/`：按 Creator 3.8 源码职责拆分的课程模型。

## 本课输入到画面

quad 是两个三角形组成的矩形，UV 从左下 (0,0) 到右上 (1,1)。checkerTexture 是 2×2 RGBA 贴图，四格颜色依次为红、绿、蓝、白。顶点 Shader 将 UV 写入 out v_uv；光栅化会在每个片元插值 v_uv；片元 Shader 用 texture(u_texture,v_uv) 取颜色。画面应显示四格棋盘，能看到从 UV 到贴图采样的完整路径。

## 对照 Creator 3.8.7 源码

- [`editor/assets/effects/for2d/builtin-sprite.effect`](../../engine/3.8.7engine/editor/assets/effects/for2d/builtin-sprite.effect)
- [`cocos/gfx/webgl2/webgl2-shader.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-shader.ts)

这课只走 Creator 3.8.7 的 WebGL2 路径；不把 Creator 2.4 的 WebGL1 Shader 语法和 3.8 的 Effect 格式混在一起。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。画布执行 WebGL2 编译与绘制，日志说明调用顺序。课程使用 Creator 3.8 的 WebGL2 GLSL 写法；原生或 WebGPU 后端不属于浏览器运行证据。 课程不启动 Creator Editor 或完整引擎，省略资产导入、Effect YAML 全语法和完整 GFX 状态。

下一课：自定义 Uniform 与材质参数。
