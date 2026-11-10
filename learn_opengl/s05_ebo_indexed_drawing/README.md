# 第 5 课：EBO 与索引绘制

矩形由两个三角形组成，但两个三角形共享一条对角线上的顶点。本课用 4 个顶点和 6 个索引绘制矩形，观察 EBO 如何让 GPU 按索引读取 VBO 中已有的顶点。

## 学完后你能

- 区分顶点缓冲 VBO 与元素缓冲 EBO 保存的数据。
- 读懂 `glDrawElements` 的图元类型、索引数量、索引类型和字节偏移。
- 说明 VAO 如何保存顶点属性配置和 EBO 绑定。

## 顶点与索引

矩形的 4 个顶点按逆时针方向编号：

```text
3 -------- 2
|        / |
|      /   |
|    /     |
|  /       |
0 -------- 1
```

索引序列是：

```cpp
{ 0, 1, 2, 2, 3, 0 }
```

前三个索引组成三角形 `(0, 1, 2)`，后三个组成三角形 `(2, 3, 0)`。顶点 0 和 2 被两次引用，所以矩形只需保存 4 份顶点数据，而不必为两个三角形重复保存 6 份。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s05_ebo
```

窗口中会显示由两个三角形组成的彩色矩形。按 Esc 关闭窗口。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。

### 创建 EBO

顶点位置和颜色放在 VBO 中，索引单独放入 EBO：

```cpp
const GLuint indices[] = { 0, 1, 2, 2, 3, 0 };
glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, indexBuffer);
glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);
```

本例的索引元素是 `GLuint`，因此绘制时使用 `GL_UNSIGNED_INT`。EBO 绑定到当前 VAO；配置完后解绑 VAO 即可，不要在 VAO 仍绑定时把 `GL_ELEMENT_ARRAY_BUFFER` 解绑，否则会清除这个 VAO 保存的 EBO 绑定。

### 发出索引绘制

```cpp
glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, nullptr);
```

- `GL_TRIANGLES`：每 3 个索引组成一个三角形。
- `6`：从 EBO 读取 6 个索引。
- `GL_UNSIGNED_INT`：每个索引是无符号 32 位整数。
- `nullptr`：从 EBO 的字节偏移 0 开始读取；这里不是 CPU 端索引数组地址。

把 `6` 改成 `3` 只会绘制第一个三角形。改变索引顺序会改变三角形的顶点组合；如果越过索引缓冲范围，读取结果就不再是有效的顶点编号。

## 动手观察

1. 把索引改成 `{ 0, 1, 2, 0, 2, 3 }`，观察矩形是否仍完整，以及对角线是否改变。
2. 将第二个三角形的最后一个索引从 `0` 改成 `1`，观察重复使用的顶点如何决定形状。
3. 把绘制数量从 `6` 改为 `3`，再改为 `5`，记录各自处理的索引数量。
4. 注释 EBO 的 `glBufferData` 或在 VAO 绑定时解绑 EBO，观察索引绘制为什么失去有效索引数据。

## 检查理解

- 为什么顶点数据在 VBO 中，而顶点编号在 EBO 中？
- `glDrawElements` 的 `count` 表示顶点数、三角形数还是索引数？
- 最后一个参数为什么是字节偏移，而不是 `indices` 数组指针？
- 为什么解绑 VAO 后，EBO 仍与刚才的 VAO 关联？

## 对照引擎源码

- [Cocos2d-x `BufferGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/BufferGL.cpp)：元素缓冲通过 `GL_ELEMENT_ARRAY_BUFFER` 上传数据。
- [Cocos2d-x `CommandBufferGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/CommandBufferGL.cpp)：`drawElements` 绑定索引缓冲，再把图元类型、索引类型、数量和偏移传给 `glDrawElements`。

第 4 课关注 VBO 字节如何排列和更新；本课增加一份索引缓冲，让多个图元引用同一份顶点数据。
