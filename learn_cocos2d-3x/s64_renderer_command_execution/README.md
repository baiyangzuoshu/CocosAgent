# 第 64 课：Cocos2d-x 3.x Renderer 执行 MeshCommand

**本课问题：** 3.x 节点生成的 MeshCommand 怎样被 Renderer 执行？

## 本版渲染路径

节点先把 MeshCommand 放入 Renderer。Renderer.render 按 ID 排序并遍历队列；processRenderCommand 遇到 MeshCommand 时处理 2D flush 和材质批次边界。跳过合批的命令调用 MeshCommand::execute；该函数应用 GLProgramState/RenderState 后直接调用 OpenGL glDrawElements。本版没有 4.0 的 backend CommandBuffer。

## 源码位置

- [CCRenderer.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCRenderer.cpp)：render 排序队列；processRenderCommand 分派 MeshCommand。
- [CCMeshCommand.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCMeshCommand.cpp)：execute 绑定 GL Buffer、应用状态并 glDrawElements；batchDraw 也直接发 OpenGL。
- [CCRenderCommand.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCRenderCommand.cpp)：基础渲染命令类型和排序数据。

## 独立代码与简化

src/cocos/renderer/ 保留可排序命令队列、MeshCommand 和执行分支。GL 函数用日志替代；示例设置 skipBatching，聚焦队列分派后的直接命令执行。

## 编译运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos/renderer/CCMeshCommand.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-3x-s64
/tmp/cocos2d-3x-s64
~~~

输出先加入并排序命令，再由 Renderer 分派到 MeshCommand::execute 和 glDrawElements。
