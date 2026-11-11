# 第 63 课：4.0 Sprite3D 与多 Pass MeshCommand

**本课问题：** 4.0 如何按材质 Pass 为 Mesh 准备并提交多个 MeshCommand？

## 本版渲染路径

Sprite3D::draw() 逐个调用 Mesh::draw()。Mesh 为当前 Technique 的每个 Pass 准备一个 MeshCommand；Material::draw() 再把对应命令交给 Pass::draw()。Pass 写入 backend 顶点/索引 Buffer、绘制范围、ProgramState 和回调，然后把 MeshCommand 加入 Renderer。相较 3.x 的单个 GL MeshCommand，4.0 的 Pass 命令承载 backend 绘制状态。

## 源码位置

- [CCSprite3D.cpp](../../engine/cocos2d-x-4/cocos/3d/CCSprite3D.cpp)：`draw()` 遍历模型中的 Mesh。
- [CCMesh.cpp](../../engine/cocos2d-x-4/cocos/3d/CCMesh.cpp)：按 Technique Pass 准备 MeshCommand，再调用 Material::draw()。
- [CCMaterial.cpp](../../engine/cocos2d-x-4/cocos/renderer/CCMaterial.cpp)：逐个 Pass 分发对应 MeshCommand。
- [CCPass.cpp](../../engine/cocos2d-x-4/cocos/renderer/CCPass.cpp)：填入 backend Buffer、ProgramState、绘制范围和回调，再加入 Renderer。
- [CCRenderer.cpp](../../engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp)：接收 MESH_COMMAND 并在渲染阶段处理。

## 独立代码与简化

`src/cocos/3d/`、`src/cocos/renderer/` 分别保留 Mesh、Material、Pass、MeshCommand 与 Renderer。示例用字符串表示 backend Buffer 和 Pass；不创建 GPU 资源，也不执行命令。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/3d/CCSprite3D.cpp src/cocos/3d/CCMesh.cpp src/cocos/renderer/CCMeshCommand.cpp src/cocos/renderer/CCRenderer.cpp src/cocos/renderer/CCPass.cpp src/cocos/renderer/CCMaterial.cpp -o /tmp/cocos2d-4x-s63
/tmp/cocos2d-4x-s63
~~~

示例中的 body 有 forward/shadow 两个 Pass，glass 有 transparent 一个 Pass，因此 Renderer 收到三个 MeshCommand；命令如何进入 backend 提交由第 64 课继续。
