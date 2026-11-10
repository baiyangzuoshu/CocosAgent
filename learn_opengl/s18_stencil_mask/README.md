# 第 18 课：模板测试与遮罩

左侧先把圆形区域写入 stencil buffer，再用这个区域限制矩形绘制；右侧绘制同一个矩形但不启用模板测试。按上下方向键改变圆形范围，观察 stencil 值如何决定哪些片段能写入颜色缓冲。

## 学完后你能

- 说明 stencil buffer 如何为片段提供整数测试值，以及它与颜色缓冲的区别。
- 解释 `glStencilFunc`、`glStencilOp` 和 `glStencilMask` 分别控制什么。
- 描述先写遮罩、再比较遮罩的两次绘制流程。
- 区分模板测试失败、深度测试失败和两项测试都通过时使用的 stencil 操作。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s18_stencil_mask
```

- `Up` / `Down`：增大 / 减小圆形遮罩半径。
- `Esc`：关闭窗口。

窗口左侧是模板遮罩结果，右侧是关闭模板测试后的对照。程序请求 8 位 stencil buffer，并检查默认 framebuffer 是否实际提供 stencil 位；如果没有，程序会给出错误并退出。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。每帧先将 stencil buffer 清为 0。随后左侧面板执行两次绘制：第一遍只更新 stencil 值，第二遍只允许 stencil 值为 1 的片段更新颜色。右侧直接绘制矩形，不做模板比较。

### 第一遍：写入遮罩区域

```cpp
glEnable(GL_STENCIL_TEST);
glStencilMask(0xFF);
glStencilFunc(GL_ALWAYS, 1, 0xFF);
glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE);
glColorMask(GL_FALSE, GL_FALSE, GL_FALSE, GL_FALSE);
drawCircle();
```

`glStencilFunc` 的 `GL_ALWAYS` 让圆形覆盖的片段通过模板比较，参考值是 `1`。`glStencilOp` 的三个参数依次对应模板测试失败、模板通过但深度测试失败、两项测试都通过；本例关闭深度测试，所以圆形片段走第三项 `GL_REPLACE`，把 stencil 值改为参考值 `1`。`glStencilMask(0xFF)` 允许写入所有 stencil 位。

颜色写掩码设为全假，因此第一遍不会把圆形写进颜色缓冲，但它仍然能更新 stencil buffer。恢复颜色掩码后，再绘制可见内容。

### 第二遍：用遮罩限制绘制

```cpp
glStencilMask(0x00);
glStencilFunc(GL_EQUAL, 1, 0xFF);
glStencilOp(GL_KEEP, GL_KEEP, GL_KEEP);
drawRectangle();
```

`GL_EQUAL` 比较 stencil 中已有的值与参考值。只有值为 `1` 的片段通过，因此左侧矩形只显示在先前写入的圆形范围内。写掩码设为零，避免这一遍改动遮罩；三个操作都设为 `GL_KEEP`，保留已有 stencil 值。

每帧开始前先恢复 `glStencilMask(0xFF)` 再调用 `glClear(GL_STENCIL_BUFFER_BIT)`。清屏也受 stencil 写掩码影响；如果写掩码仍是零，清除请求可能不会覆盖 stencil 位。`GL_STENCIL_TEST` 控制是否比较，`glStencilFunc` 控制比较方式，`glStencilMask` 控制哪些位可以写入，这三者作用不同。

## 动手观察

1. 初始时比较左右面板：左侧矩形只在圆内可见，右侧矩形完整显示。
2. 按 `Up` 和 `Down` 改变半径，观察 stencil 区域变化，而矩形几何本身不变。
3. 把第二遍的比较条件改为 `GL_NOTEQUAL`，观察矩形显示在圆外。
4. 将第一遍的 `glStencilOp` 最后一项从 `GL_REPLACE` 改为 `GL_KEEP`，观察 stencil 值没有被写成 1 后会发生什么。
5. 暂时移除 `glColorMask`，观察第一遍对颜色缓冲留下的圆形颜色，再与只更新 stencil 的版本比较。

## 检查理解

- 为什么第一遍使用 `GL_ALWAYS`，第二遍改成 `GL_EQUAL`？
- `glStencilMask(0x00)` 是否会关闭 stencil 测试？它具体阻止什么？
- 如果 stencil 测试通过、深度测试失败，`glStencilOp` 的第二项会生效吗？本例为什么观察不到它？
- 为什么清除 stencil buffer 前要恢复允许写入的掩码？
- 颜色写掩码关闭时，为什么 stencil buffer 仍然能被更新？

## 对照引擎源码

- Cocos2d-x 4.0 [`DepthStencilStateGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/DepthStencilStateGL.cpp) 在模板测试启用时应用比较函数、三种模板操作和写掩码；正反面状态相同时调用 `glStencilFunc`、`glStencilOp`、`glStencilMask`，不同时使用对应的 `Separate` 版本。
- Creator 3.8.7 [`pipeline-sub-state.ts`](../../engine/3.8.7engine/cocos/gfx/base/pipeline-sub-state.ts) 的 GFX `DepthStencilState` 分别保存正面和背面的模板开关、比较函数、读写掩码、失败/通过操作与参考值；WebGL2 [`webgl2-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts) 将这些状态映射到 `STENCIL_TEST`、`stencilFuncSeparate`、`stencilOpSeparate` 和 `stencilMaskSeparate`。

本例只使用默认 framebuffer 的 stencil buffer、单个参考值和不透明平面图形，并关闭深度测试；它没有演示深度失败操作、正反面不同规则、多层遮罩组合或多重采样。源码对照展示的是状态表达与后端调用的对应关系，不代表 Creator 的完整渲染流程只有这几项状态。
