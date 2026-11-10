# 第 9 课：View 矩阵与相机

网格、坐标轴、原点和三角形都固定在世界坐标中。本课用 WASD 移动相机、Q/E 转动相机；每帧更新 View 矩阵，观察静止场景如何在屏幕上反向移动。

## 学完后你能

- 说明 View 矩阵是相机世界变换的逆矩阵。
- 用相机位置和朝向构造 `R(-yaw) * T(-position)`。
- 区分移动相机与移动场景物体产生的视觉结果。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s09_view_matrix
```

窗口中的场景是静态世界坐标；红点标记世界原点。

- `W/A/S/D`：沿相机本地坐标的上下左右移动。
- `Q/E`：绕相机自身原点向左或向右旋转。
- `Esc`：关闭窗口。

相机移动时，网格、原点和三角形会朝相反方向移动。旋转相机时，整个静态场景围绕相机视点转动。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。

### 相机矩阵的逆

相机在世界中的变换先把相机局部坐标旋转，再平移到相机位置：

```text
C = T(cameraPosition) * R(cameraYaw)
```

顶点要从世界坐标变到相机坐标，因此使用它的逆矩阵：

```text
View = inverse(C)
     = R(-cameraYaw) * T(-cameraPosition)
```

程序用列向量和列主序存储矩阵。每帧把 `View` 传给顶点着色器：

```glsl
gl_Position = uView * vec4(aPosition, 1.0);
```

网格和三角形的 VBO 只在初始化时上传；键盘输入只改变相机状态与 View uniform，没有改写场景顶点。

### 简化边界

本例是二维相机，只平移和绕 Z 轴旋转。它省略 Model 矩阵、View 之后的 Projection 矩阵和 3D `lookAt` 相机基向量；当前世界坐标直接送入裁剪空间。下一课再加入透视/正交投影和视口映射。

## 动手观察

1. 按 `D` 移动相机向右，观察固定的世界原点在屏幕上向左移动。
2. 按 `Q` 转动相机，再按 `W` 前进，比较相机本地移动方向如何随朝向改变。
3. 暂时把 View 矩阵中的相机位置改成正值，观察为什么会把场景朝相机移动的方向变换。
4. 把 `uView` 改为单位矩阵，确认场景回到初始观察位置。

## 检查理解

- 为什么相机向右移动时，静止场景看起来向左移动？
- 为什么 View 矩阵要取相机世界矩阵的逆？
- `R(-yaw) * T(-position)` 中，为什么要先平移世界再旋转到相机朝向？
- 这个示例还缺少哪一步，才能把相机坐标映射到裁剪空间？

## 对照引擎源码

- [Creator 2.4.15 `camera.js`](../../engine/2.4.15engine/cocos2d/renderer/scene/camera.js)：从相机节点取得世界旋转/平移矩阵并求逆，生成 View 矩阵。
- [Creator 2.4.15 `forward-renderer.js`](../../engine/2.4.15engine/cocos2d/renderer/renderers/forward-renderer.js)：将 View、Projection 和 View-Projection 矩阵设置为渲染 uniform。
- [Creator 3.8.7 `camera.ts`](../../engine/3.8.7engine/cocos/render-scene/scene/camera.ts)：从节点世界矩阵求逆得到 View 矩阵，并在相机更新路径中组合 View-Projection。

这些链接定位的是仓库中对应版本的静态源码。桌面示例说明 View 矩阵的职责，不验证 Creator 项目、Native 或 Web 后端的相机行为。
