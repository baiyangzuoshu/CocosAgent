# 第 63 课：Creator 2.4 MeshRendererAssembler 处理子网格

**本课问题：** 2.4 的 MeshRenderer 怎样逐个提交 Mesh 子网格？

## 本版渲染路径

RenderFlow 调用组件 assembler 的 `fillBuffers()`。MeshRendererAssembler 按索引遍历 `Mesh.subMeshes` 和 `Mesh.subDatas`，用对应材质处理每一项：可合批的三角形把顶点和重基址索引写入 Renderer 的 MeshBuffer；关闭自动合批、数据格式不支持或图元不是三角形时，先 flush，再直接提交 InputAssembler。

这个版本的 MeshRenderer 不是 3.8 的 Model/SubModel 结构；`CCModel.js` 保存的是模型节点/骨骼数据，不是 MeshRenderer 的提交对象。

## 源码位置

- [CCMeshRenderer.js](../../engine/2.4.15engine/cocos2d/core/mesh/CCMeshRenderer.js)：Mesh 属性、材质槽及空的 `_checkBacth()` 钩子。
- [CCMesh.js](../../engine/2.4.15engine/cocos2d/core/mesh/CCMesh.js)：`subMeshes` 保存 InputAssembler，`subDatas` 保存顶点/索引数据。
- [CCModel.js](../../engine/2.4.15engine/cocos2d/core/3d/CCModel.js)：本版资产中的节点/绑定姿势数据，不是 MeshRenderer 的 Model/SubModel 包装。
- [mesh-renderer.js](../../engine/2.4.15engine/cocos2d/core/mesh/mesh-renderer.js)：`fillBuffers()` 在 MeshBuffer 合批与 `_flushIA()` 直提之间选择。
- [render-flow.js](../../engine/2.4.15engine/cocos2d/core/renderer/render-flow.js)：`_render()` 先调 `_checkBacth()`，再调 assembler 的 `fillBuffers()`。

## 独立代码与简化

`src/cocos2d/core/mesh/` 保留 Mesh、MeshRenderer 和 assembler 分层；示例用两个子网格分别演示合批写入和直接 InputAssembler 提交。Renderer 只记录材质槽、顶点偏移与索引，不创建 WebGL Buffer 或执行 draw。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000/，观察三角形子网格写入 MeshBuffer，线图元子网格 flush 后走 `_flushIA()`。
