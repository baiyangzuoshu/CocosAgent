# 第 63 课：Creator 3.8 MeshRenderer 创建 Model/SubModel

**本课问题：** MeshRenderer 如何把每个 RenderingSubMesh 和材质槽交给 RenderScene？

## 本版渲染路径

MeshRenderer 的 `_updateModels()` 创建 Model，再由 `_updateModelParams()` 遍历 `mesh.renderingSubMeshes`，按索引取材质并调用 `Model.initSubModel()`。Model 创建 SubModel；SubModel 初始化 InputAssembler 和 DescriptorSet。最后 ModelRenderer 将 Model 加入场景的 RenderScene。

## 源码位置

- [mesh-renderer.ts](../../engine/3.8.7engine/cocos/3d/framework/mesh-renderer.ts)：`_createModel()`、`_updateModels()`、`_updateModelParams()` 和 `_attachToScene()`。
- [model-renderer.ts](../../engine/3.8.7engine/cocos/misc/model-renderer.ts)：保存组件关联的 Model 并提供场景挂接入口。
- [model.ts](../../engine/3.8.7engine/cocos/render-scene/scene/model.ts)：`initSubModel()` 按索引建立 SubModel。
- [submodel.ts](../../engine/3.8.7engine/cocos/render-scene/scene/submodel.ts)：`initialize()` 创建 GFX InputAssembler、DescriptorSet 并保存材质 Pass。

## 独立代码与简化

`src/cocos/3d/framework/`、`src/cocos/misc/` 和 `src/cocos/render-scene/scene/` 保留组件、基类、Model 与 SubModel 的职责边界。示例用两个子网格和两种材质观察索引对应关系，不创建真实 GFX 对象。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000/，看到一个 Model 收到两个 SubModel 后加入 RenderScene。
