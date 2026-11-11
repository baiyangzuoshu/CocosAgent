# 第 29 课：Instanced Drawing

用同一份带索引的四边形网格绘制 640 个彩色小方块。按键切换逐个提交与实例化提交；两种模式使用相同的几何和每个方块的数据，窗口标题显示对象数和 draw call 数量。

## 学完后你能

- 区分顶点属性和每实例属性的更新频率。
- 用 `glVertexAttribDivisor` 指定一个实例记录供一个实例使用。
- 对比循环调用 `glDrawElements` 和单次调用 `glDrawElementsInstanced`。
- 说明实例化减少的是 CPU 侧绘制提交次数，不会减少实例本身的顶点处理量。
- 理解较少的 draw call 不自动等于更高帧率，瓶颈仍可能在 GPU、带宽或其他阶段。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、桌面 OpenGL 3.3、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s29_instanced_drawing
```

- `1`：逐对象绘制，每个方块调用一次 `glDrawElements`。
- `2`：实例化绘制，一次 `glDrawElementsInstanced` 提交所有方块。
- `R`：切回实例化模式。
- `Esc`：关闭窗口。

窗口标题会显示当前模式、实例数量和绘制调用数量。逐对象模式会提交 640 个 draw call；实例化模式会提交 1 个。这个数量是 API 调用数，不是 CPU/GPU 耗时基准。

## 同一网格的两种提交方式

```text
四个顶点 + 六个索引 ───────────────┐
                                    ├─ 每个对象的 offset / scale / color
实例数据缓冲区 (640 条记录) ───────┘
           │
           ├─ 模式 1：uniform 更新 → glDrawElements × 640
           │
           └─ 模式 2：实例属性 divisor=1 → glDrawElementsInstanced × 1
```

`Vertex` 和 EBO 只描述一个单位方块。每条 `InstanceData` 记录描述一个方块的偏移、缩放和颜色。实例路径把这些字段接到顶点属性位置 1–3，再用 `glVertexAttribDivisor(location, 1)` 告诉 OpenGL：该属性每画一个实例才前进一条记录；位置属性仍然按每个顶点前进。非实例路径则通过 uniform 逐个设置同样的偏移、缩放和颜色。

两种路径最终都会为 640 个方块处理网格顶点。实例化路径把许多绘制提交合并为一次调用，减少 CPU 与驱动之间的提交开销；它没有把 640 个方块变成只处理一份顶点，也没有自动合并材质、状态或透明排序。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。

1. `makeInstances` 生成固定网格的 640 条实例记录。
2. `createMesh` 把单位方块、EBO 和实例缓冲区接入同一个 VAO。
3. `glVertexAttribDivisor` 将偏移、缩放、颜色标记为每实例属性。
4. `drawPerObject` 逐个写 uniform 并调用 `glDrawElements`。
5. `drawInstanced` 设置实例化开关，再以实例总数调用 `glDrawElementsInstanced`。

把网格改成 10 × 10、40 × 30 或更多，观察 draw call 数和实例数的差异；再把某个实例属性的 divisor 改为 0，看看每个顶点如何开始读取不同的数据。不要只看窗口标题里的 draw call 数就断言 GPU 帧时间会按相同比例下降。

## 检查理解

- `glDrawElementsInstanced` 的索引数量和实例数量分别表示什么？
- divisor 为 0 与 divisor 为 1 时，顶点属性分别以什么频率前进？
- 为什么实例化仍要处理每个方块的顶点？
- 如果各实例需要不同颜色，颜色数据应该放在 uniform 还是实例属性中？
- 哪些因素可能让 draw call 减少后帧率仍没有明显变化？

## 对照 Creator 3.8.7 源码

- [`webgl2-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts) 在设置顶点输入时，根据 `glAttrib.isInstanced` 调用 `gl.vertexAttribDivisor(glLoc, 1)` 或 `gl.vertexAttribDivisor(glLoc, 0)`。提交绘制时，如果 `drawInfo.instanceCount` 非零且有索引缓冲区，就走 `gl.drawElementsInstanced`；没有实例数时则走普通 `gl.drawElements`。本例用原生 OpenGL 3.3 的属性和 draw call 对应这两个分支。

本例只展示一个固定网格、一个材质和颜色属性的基本路径；没有实现模型矩阵缓冲、多个材质分组、间接绘制、GPU 剔除或引擎内部的输入装配缓存。Creator 3.8.7 这里是 WebGL2 命令后端的源码证据，不能据此推断其他后端的具体提交方式。
