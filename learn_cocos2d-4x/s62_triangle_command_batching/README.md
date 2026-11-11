# 第 62 课：4.0 QuadCommand 合批与 material ID

**本课问题：** 4.0 Renderer 怎样把兼容的 2D Quad/Triangles 命令并成一次后端绘制？

## 本版渲染路径

QuadCommand 为纹理、程序类型和混合因子生成 material ID。Renderer 收集 TrianglesCommand，复制顶点/索引到共享缓冲；连续命令 material ID 相同且允许合批时合成一组。自定义程序命令会跳过合批并隔开前后批次；缓冲容量耗尽时也会先绘制队列。每组最终交给 backend CommandBuffer.drawElements()。

## 源码位置

- [CCQuadCommand.cpp](../../engine/cocos2d-x-4/cocos/renderer/CCQuadCommand.cpp)：QuadCommand 初始化三角形输入并建立 material ID。
- [CCRenderCommand.h](../../engine/cocos2d-x-4/cocos/renderer/CCRenderCommand.h)：TrianglesCommand 保存 material ID 与 skip-batching 标记。
- [CCRenderer.cpp](../../engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp)：processRenderCommand() 处理容量边界；drawBatchedTriangles() 合并同 material ID 命令并绘制各组。
- [CommandBuffer.cpp](../../engine/cocos2d-x-4/cocos/renderer/backend/CommandBuffer.cpp)：backend drawElements() 提交绘制指令。

## 独立代码与简化

src/cocos/renderer/ 保留 QuadCommand、TrianglesCommand、Renderer 分组和 backend CommandBuffer 的职责。样例用可读字符串表示 material ID，以索引数模拟共享几何数据；不创建真实 GPU Buffer 或平台后端。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/renderer/CCRenderCommand.cpp src/cocos/renderer/CCQuadCommand.cpp src/cocos/renderer/CCRenderer.cpp src/cocos/renderer/backend/CommandBuffer.cpp -o /tmp/cocos2d-4x-s62
/tmp/cocos2d-4x-s62
~~~

日志会把前两个相同 material ID 的 quad 合成一组；纹理变化、自定义程序和其后的兼容命令分别形成后续组。
