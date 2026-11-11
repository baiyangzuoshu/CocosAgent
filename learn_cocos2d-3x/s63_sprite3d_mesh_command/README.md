# 第 63 课：3.x Sprite3D 到 MeshCommand

**本课问题：** 3.x 如何把 Sprite3D 的每个 Mesh 变成 Renderer 命令？

## 本版渲染路径

Sprite3D::draw() 遍历 `_meshes` 并调用 Mesh::draw()。每个 Mesh 用自己的材质、顶点/索引缓冲、图元、索引数和变换初始化一个 MeshCommand，再交给 Renderer。MeshCommand::execute() 随后绑定 GL Buffer、应用 Pass 并直接调用 `glDrawElements()`。

## 源码位置

- [CCSprite3D.cpp](../../engine/cocos2d-x-3/cocos/3d/CCSprite3D.cpp)：`draw()` 遍历 `_meshes` 并调用 Mesh。
- [CCMesh.cpp](../../engine/cocos2d-x-3/cocos/3d/CCMesh.cpp)：`draw()` 填充 MeshCommand 并调用 Renderer。
- [CCMeshCommand.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCMeshCommand.cpp)：`execute()` 绑定 GL Buffer、执行材质 Pass 和索引绘制。
- [CCRenderer.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCRenderer.cpp)：接收并排序 RenderCommand。

## 独立代码与简化

`src/cocos/3d/` 将 Sprite3D 和 Mesh 分开，`src/cocos/renderer/` 保存 MeshCommand 与 Renderer 队列。输入网格和 Buffer 用名称表示；本课只观察命令生成与入队，不运行 OpenGL。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/3d/CCSprite3D.cpp src/cocos/3d/CCMesh.cpp src/cocos/renderer/CCMeshCommand.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-3x-s63
/tmp/cocos2d-3x-s63
~~~

两个 Mesh 会各自生成并排入一个 MeshCommand；具体 GL 执行留给第 64 课。
