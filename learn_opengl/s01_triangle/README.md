# 第 1 课：画出一个三角形

## 本课问题

OpenGL 如何从一组顶点数据和两个着色器产生屏幕上的图形？

## 本课内容

- 创建 OpenGL 3.3 Core Profile 上下文。
- 编译并链接顶点着色器与片段着色器。
- 用 VAO 描述顶点属性，用 VBO 保存三个顶点。
- 用 `glDrawArrays` 提交一个三角形。

源码位于 `src/main.cpp`，构建配置位于 `CMakeLists.txt`。

## 运行准备

本课需要 CMake 3.20 或更新版本、支持 C++17 的编译器、OpenGL 开发库、GLFW 3 和为 OpenGL 3.3 Core 生成的 GLAD 1。依赖需要预先由本机提供；本项目不会下载或安装它们。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s01_triangle
```

如果 CMake 找不到已安装的 GLFW 或 GLAD，可通过 `CMAKE_PREFIX_PATH` 指向本机已有的包配置目录。

## 预期结果

打开一个深色背景窗口，中央显示一个彩色三角形。按 Esc 关闭窗口。

## 对照引擎源码

- `engine/cocos2d-x-4/cocos/renderer/backend/opengl/BufferGL.cpp`：缓冲创建和数据上传。
- `engine/cocos2d-x-4/cocos/renderer/backend/opengl/ProgramGL.cpp`：图形程序创建及着色器关联。
- `engine/cocos2d-x-4/cocos/renderer/backend/opengl/CommandBufferGL.cpp`：`prepareDrawing` 绑定绘制所需状态，`bindVertexBuffer` 设置顶点属性，`drawArrays`/`drawElements` 发起绘制。
- `engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts`：GFX 命令在 WebGL2 后端的处理。
- [Creator 2.4.15 渲染路径](../../docs/2.x/06-graphics-rendering.md)：从 Sprite 几何、批处理到设备绘制的上层路径。

## 简化说明

本课只绘制一个三角形，省略相机矩阵、纹理、深度测试、资源缓存和批处理。Cocos 引擎还会在 `glDraw*` 之前处理场景遍历、相机可见性、材质 Pass 和图形状态；这些内容会在后续课程中逐步加入。
