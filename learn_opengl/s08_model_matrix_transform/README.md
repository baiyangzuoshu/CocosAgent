# 第 8 课：Model 矩阵与物体变换

三角形顶点一直保存在局部坐标中。本课每帧改变传给顶点着色器的 Model 矩阵，让三角形绕自己的局部原点旋转、缩放并移动；白点标出它的旋转中心。

## 学完后你能

- 说明 Model 矩阵如何把物体局部坐标变换到场景坐标。
- 用 `T * R * S` 组合平移、旋转和缩放，并解释作用顺序。
- 在不改写顶点缓冲的情况下，通过 `glUniformMatrix4fv` 更新矩阵。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s08_model_matrix
```

窗口中三角形会持续旋转并改变大小。白点标出三角形的局部原点经过平移后的位置。按 Esc 关闭窗口。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。

### 顶点留在局部坐标

三个三角形顶点围绕局部原点 `(0, 0, 0)` 定义，VBO 在初始化时上传一次。顶点着色器使用 Model 矩阵变换每个顶点：

```glsl
uniform mat4 uModel;

void main() {
    gl_Position = uModel * vec4(aPosition, 1.0);
}
```

本例省略 View 和 Projection 矩阵，变换结果直接送入裁剪空间。因此屏幕位置便于观察，但这里不构成完整的相机管线。

### 每帧构造 Model 矩阵

程序用列向量和列主序存储，组合顺序为：

```cpp
model = translation * rotationZ * scale;
glUniformMatrix4fv(modelLocation, 1, GL_FALSE, model.values.data());
```

`S` 先缩放局部顶点，`R` 再绕局部原点旋转，最后 `T` 把物体移到场景位置。白色 pivot 点只使用 `T`，所以它保持在物体旋转中心。`GL_FALSE` 表示 OpenGL 不要转置提供的列主序矩阵。

动画角度随时间增加，缩放因子在一个正值范围内往复变化。每帧只更新 uniform，三角形的局部顶点数据保持不变。

## 动手观察

1. 把矩阵顺序改为 `rotationZ * translation * scale`，观察物体怎样围绕场景原点运动。
2. 暂时移除 `T`，确认物体会绕屏幕中心的局部原点转动。
3. 固定缩放因子，只观察旋转；再固定角度，只观察缩放。
4. 修改局部三角形顶点，让几何中心偏离 `(0, 0, 0)`，观察 pivot 为什么仍保持在白点。

## 检查理解

- 为什么 `T * R * S` 中的平移最后作用，却写在矩阵乘积最左侧？
- 为什么先旋转再平移会让物体绕自身原点旋转？
- Model 矩阵变化时，为什么不必重新调用 `glBufferData`？
- 本例将 Model 变换结果直接当作裁剪坐标，省略了哪两个矩阵？

## 对照引擎源码

- [Creator 2.4.15 `CCNode.js`](../../engine/2.4.15engine/cocos2d/core/CCNode.js)：节点先更新本地矩阵，再将父节点世界矩阵与本地矩阵相乘得到世界矩阵。
- [Creator 3.8.7 `node.ts`](../../engine/3.8.7engine/cocos/scene-graph/node.ts)：节点的 `matrix` 属性表示本地变换，`worldMatrix` 访问器更新并返回世界变换矩阵。

这些链接用于定位指定版本的源码实现。桌面 OpenGL 示例展示矩阵职责和乘法顺序，不验证 Creator 项目或其他平台的运行行为。
