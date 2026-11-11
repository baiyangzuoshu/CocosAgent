# 第 59 课：3.x Renderer 汇总并上传顶点

**本课问题：** 多条 TrianglesCommand 如何汇入 Renderer 的共享顶点/索引数组，再上传到 GL Buffer？

## 本版渲染路径

Renderer 收集 TrianglesCommand 后，将顶点复制到共享 staging 数组，并把每条命令的局部索引加上当前顶点偏移。drawBatchedTriangles 汇总完成后，把顶点和索引数组交给 GL VBO。源码还按设备能力选择 map/orphan 或直接 glBufferData；本例保留直接传数组的 GL 分支。本课停在缓冲更新，不展开后续 draw 命令执行。

## 源码位置

- [CCRenderer.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCRenderer.cpp)：fillVerticesAndIndices 与 drawBatchedTriangles 的汇总、缓冲上传路径。
- [CCRenderer.h](../../engine/cocos2d-x-3/cocos/renderer/CCRenderer.h)：共享顶点/索引缓冲与批次结构。
- [CCTrianglesCommand.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCTrianglesCommand.cpp)：命令保存三角形输入。

## 独立代码与简化

src/cocos/renderer/CCRenderer 只收集一条命令，不执行模型变换、材质切换和真实 OpenGL 调用。GLDevice 打印缓冲目标、字节数与 usage；代码保留索引重基址步骤。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-3x-s59
/tmp/cocos2d-3x-s59
~~~

输出显示四个顶点和六个索引进入 Renderer staging，再分别上传到 ARRAY_BUFFER 与 ELEMENT_ARRAY_BUFFER。
