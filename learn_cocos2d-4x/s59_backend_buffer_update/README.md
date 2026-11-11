# 第 59 课：4.0 Renderer 更新 backend Buffer

**本课问题：** Renderer 汇总后的顶点/索引如何通过 backend Buffer 更新？

## 本版渲染路径

Renderer 将 TrianglesCommand 顶点复制到共享数组，并把局部索引加上顶点缓冲偏移。OpenGL 路径调用 backend Buffer.updateData；Metal 路径可用 updateSubData 写入指定区间。BufferGL 将接口落实为 glBufferData/glBufferSubData。后续 CommandBuffer 绑定缓冲并绘制属于第 64 课，本课停在后端缓冲更新。

## 源码位置

- [CCRenderer.cpp](../../engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp)：fillVerticesAndIndices、updateData/updateSubData。
- [CCTrianglesCommand.cpp](../../engine/cocos2d-x-4/cocos/renderer/CCTrianglesCommand.cpp)：命令保存三角形输入。
- [Buffer.h](../../engine/cocos2d-x-4/cocos/renderer/backend/Buffer.h)：backend Buffer 抽象接口。
- [BufferGL.cpp](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/BufferGL.cpp)：OpenGL 后端的 updateData 与 updateSubData。

## 独立代码与简化

src/cocos/renderer/CCRenderer 用 backend::Buffer 接口提交汇总数组，BufferGL 仅打印 OpenGL 后端调用。示例选择 OpenGL updateData 路径，不创建真实设备，不记录 CommandBuffer 绘制命令，也不覆盖 Metal。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/renderer/CCRenderer.cpp src/cocos/renderer/backend/opengl/BufferGL.cpp -o /tmp/cocos2d-4x-s59
/tmp/cocos2d-4x-s59
~~~

观察 Renderer 通过相同 backend 接口分别更新顶点缓冲和索引缓冲；下一课次再追踪后端命令提交。
