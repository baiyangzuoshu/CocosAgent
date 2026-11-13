# 第 91 课：Asset 引用与依赖图

**本课目标：** 从 Scene 和 Prefab 的序列化数据提取 UUID 引用，分清直接依赖和递归依赖。

## 先理解箭头方向

图里的 A → B 表示：加载 A 时，A 需要资源 B。它不是节点层级关系，也不是“B 文件放在 A 文件夹里”。

本课只追 soldier 这一条链：

~~~text
main.scene 的 PrefabInfo.asset.__uuid__
SceneAsset ─────────────────────────────→ Prefab
soldier.prefab 的 MeshRenderer._mesh.__uuid__
Prefab ─────────────────────────────────→ FBX Mesh 子资源 @18751
~~~

Prefab 的 Mesh UUID 来自 FBX 导入产生的子资源。它不是 FBX 主资源，也不是 Prefab UUID。

## 逐步对应真实文件

1. 在 assets/scene/main.scene 找 PrefabInfo 的 asset.__uuid__，选中 soldier 的 Prefab UUID。
2. 在 assets/model/helloWorld/soldier.prefab 搜索 _mesh.__uuid__。
3. 在 soldier.FBX.meta 的 subMetas["18751"] 确认这个 UUID 对应 gltf-mesh。
4. 把场景和 Prefab 两个引用连起来，得到 SceneAsset → Prefab → Mesh。
5. 递归加载场景时，需要把这条链上的资源都解析成运行时 Asset 对象。

## Asset 是什么

Asset 是运行时可使用的对象，例如 SceneAsset、Prefab、Mesh。它与磁盘文件不是一回事：Prefab 和 Scene 的序列化数据可能放在同一个 import pack，而 Mesh 的二进制数据在 native 文件中。

Asset 的 refCount 用来跟踪资源对象被保留的引用，不表示网络请求次数。本课手动 addRef 一次只是展示字段；真实引用由加载、节点和资源释放流程协同管理。

## 代码怎么做

- collectUuidReferences 递归访问对象，只收集 __uuid__ 外部资源引用。
- __id__ 代表同一份序列化文件内部的对象连接，本课不把它当成另一个 Asset。
- DependencyGraph.add 保存一条依赖边；collect 从 Scene 开始递归走图。
- 示例是从实际 Scene/Prefab 摘出的最小字段，不解析完整的场景或 Prefab 文件。

`src/example-dependencies.ts` 放场景/Prefab 序列化片段；`src/cocos/asset/asset-manager/depend-util.ts` 提取 UUID 引用；`src/main.ts` 组图并遍历。建议依次读数据、提取函数、图遍历调用。

运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

页面先看每一条引用来自哪个序列化字段，再看从 Scene 出发能到达哪些 Asset。

## 源码对照

- engine/3.8.7engine/cocos/asset/asset-manager/depend-util.ts：_parseDepsFromJson、getDeps 解析并缓存 UUID 依赖。
- engine/3.8.7engine/cocos/asset/asset-manager/load.ts：loadDepends 加载依赖。
- engine/3.8.7engine/cocos/asset/assets/asset.ts：运行时 Asset 基类。

下一课会让 AssetManager 按依赖图执行加载，而不只是打印这张图。
