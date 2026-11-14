# 第 91 课：从场景和 Prefab 画出依赖

**本课目标：** 看懂 `main.scene` 为什么会继续需要 soldier Prefab，以及 Prefab 为什么会继续需要 Mesh。这里只讲 Asset 之间的关系，不计算 URL。

## 先从真实文件各取一条引用

打开 `3.8NewProject/assets/scene/main.scene`，搜索 Prefab UUID `cfc53c4e-7956-482b-aebc-3fb1dcd36eef`。它出现在 `$[45].asset.__uuid__`，表示场景里的 PrefabInfo 引用了 soldier Prefab。

再打开 `3.8NewProject/assets/model/helloWorld/soldier.prefab`，搜索 Mesh UUID `e3553cad-2f15-4293-859a-8f43c780f289@18751`。它出现在 `$[4]._mesh.__uuid__`，表示这个对象的 MeshRenderer 引用了 Mesh 子资源。

```text
main.scene 的 PrefabInfo.asset.__uuid__ → soldier Prefab
soldier.prefab 的 MeshRenderer._mesh.__uuid__ → soldier Mesh @18751

SceneAsset → Prefab → Mesh
```

这说明加载场景时不能只准备 SceneAsset：场景还会用 Prefab，Prefab 还会用 Mesh。Asset 依赖是“对象需要对象”的关系，不等于“一条边对应一个文件请求”。Scene 与 Prefab 后面会证明可以共用一个 import pack。

## 为什么看 `__uuid__`，不追 `__id__`

序列化文件里的 `__uuid__` 指向另一个 Asset；`__id__` 指向同一份 JSON 数组里的对象。课程的 `serializedSceneReference`、`serializedMeshReference` 是从真实文件摘出的最小片段，所以代码可直接演示外部引用，而不必先实现 Creator 的整套反序列化格式。

## 按代码的执行顺序读

1. `src/example-dependencies.ts` 放两段字段：Scene → Prefab，以及 Prefab → Mesh。
2. `collectUuidReferences()` 从每段字段中提取 `__uuid__`。
3. `DependencyGraph.add(owner, dependency)` 记录“谁需要谁”。
4. `DependencyGraph.collect(sceneUuid)` 从 SceneAsset 出发递归访问依赖。输出应包含 soldier Prefab 和 Mesh `@18751`。
5. `src/main.ts` 用资源名显示边；需要核对真实身份时，查看 `example-dependencies.ts` 中的完整 UUID。

本课模型没有打开/解析完整 `main.scene`、Prefab 或 Mesh 文件；这些文件字段已先手动摘录。请把它当作读依赖算法的窗口，不要把这段代码当成 Creator 场景加载器。

## 对照 3.8.7 Runtime 源码

- [depend-util.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/depend-util.ts)：从 `parse()`、`_parseDepsFromJson()` 看序列化数据如何变成依赖列表。
- [load.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/load.ts)：看 `loadDepends()` 如何加载已发现的依赖。
- [asset.ts](../../engine/3.8.7engine/cocos/asset/assets/asset.ts)：Asset 基类；本课不展开资源释放和引用计数。

## 学完后自查

如果删掉 Prefab → Mesh 这条边，递归结果会少哪个 Asset？为什么 `@18751` 仍属于 UUID 的一部分？下一课看 AssetManager 怎样预取和创建这些 Asset。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
