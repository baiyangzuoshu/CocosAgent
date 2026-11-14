# 第 90 课：从 FBX `.meta` 找到 Mesh 子资源

**本课目标：** 解释场景引用的 Prefab 怎样找到 FBX 导入出的 Mesh。这里有三个 UUID，先不要把它们混为一个。

## 按真实文件逐个核对

打开 `3.8NewProject/assets/model/helloWorld/soldier.FBX.meta`：

| 身份 | 当前值 | 你在哪看到 |
| --- | --- | --- |
| FBX 主资源 UUID | `e3553cad-2f15-4293-859a-8f43c780f289` | 最外层 `uuid` |
| soldier Prefab UUID | `cfc53c4e-7956-482b-aebc-3fb1dcd36eef` | `soldier.prefab.meta` 的主 `uuid` |
| soldier Mesh 子资源 UUID | `e3553cad-2f15-4293-859a-8f43c780f289@18751` | `subMetas["18751"].uuid` |

`@18751` 是导入器生成的子资源 ID。它和 FBX 主 UUID 一起标识一个导入出的 Mesh；因此 Mesh UUID 既不等于 FBX UUID，也不等于 Prefab UUID。

接下来沿两条引用看：

1. 在 `3.8NewProject/assets/scene/main.scene` 搜索 Prefab UUID。它出现在 `$[45].asset.__uuid__`，表示场景引用 soldier Prefab。
2. 在 `3.8NewProject/assets/model/helloWorld/soldier.prefab` 搜索 Mesh UUID。它出现在 `$[4]._mesh.__uuid__`，表示 Prefab 中的 MeshRenderer 使用 Mesh 子资源。
3. 回到 FBX `.meta` 的 `subMetas["18751"]`，确认该子资源 importer 是 `gltf-mesh`。

```text
main.scene → soldier.prefab 的 UUID
soldier.prefab → soldier.FBX.meta 中的 Mesh UUID @18751
```

这条关系说明“哪个 Prefab 使用哪个 Mesh”，但还没有说明浏览器请求哪个文件；URL 要到第 93 课从构建 config 查。

## 本课代码实际做了什么

`src/example-meta.ts` 摘录主 UUID、Mesh 子 UUID 和引用字段。`findSource()` 先比较 FBX 主 UUID，再逐个比较 `subMetas`；所以输入 Mesh UUID 时，输出应是 `子资源 @18751 (gltf-mesh)`。它只是判断 UUID 属于 `.meta` 中哪个资源，不会运行 FBX 导入器。

### `.meta` 和 Bundle 配置不要混为一谈

`.meta` 是编辑器管理源资源和子资源的数据，不是 Web Runtime 要下载的 config。3.8 的 Bundle 设置放在项目设置/构建配置中；本工程的 `BundleMain.meta` 也不包含 Bundle 配置。当前构建只输出 `main` 和 `internal`，仅凭目录 `.meta` 不能推断 Bundle 生成原因。

## 对照 3.8.7 Runtime 源码

- [config.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/config.ts)：从 `_initUuid()`、`_initScene()` 看 Runtime 如何使用构建后的 UUID 索引。
- [helper.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/helper.ts)：搜索 `decodeUuid()`，看压缩 UUID 怎样还原。
- 工程事实：`soldier.FBX.meta`、`soldier.prefab`、`assets/scene/main.scene`。

引擎快照用于追踪构建后的 Runtime；Editor 导入流程不是本地 Runtime 源码的一部分。样例工程由 Creator 3.8.8 生成，源码基线是 3.8.7。

## 学完后自查

不用看文件，讲清 FBX 主资源 UUID、Prefab UUID、Mesh 子资源 UUID 各代表谁；再说明 `@18751` 为什么不能删掉。下一课把场景到 Prefab、Prefab 到 Mesh 画成依赖图。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
