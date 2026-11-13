# 第 90 课：.meta、UUID 与资源身份

**本课目标：** 看懂一个 FBX 源文件如何导入出多个资源，并确认场景中的 UUID 指向 Prefab、Mesh 还是 FBX 主资源。

## 先区分三样东西

- **源文件：** 美术导入的 soldier.FBX。
- **Asset 身份：** Creator 用 UUID 标识导入后的资源；文件名和路径用于编辑器管理，运行时引用依靠 UUID。
- **子资源：** 一个源文件可以导入出 Mesh、Skeleton、Animation 等可单独引用的资源。

所以“一个文件”不一定等于“一个 Asset”。

## 顺着当前样例查

1. 在 assets/model/helloWorld/soldier.FBX.meta 找主 uuid：e3553cad-2f15-4293-859a-8f43c780f289。
2. 找 subMetas["18751"]：它是 Mesh，UUID 为 e3553cad-2f15-4293-859a-8f43c780f289@18751。
3. 在 assets/scene/main.scene 找 cc.Prefab 引用：场景引用的是 Prefab UUID cfc53c4e-7956-482b-aebc-3fb1dcd36eef。
4. 在 assets/model/helloWorld/soldier.prefab 找 _mesh.__uuid__：Prefab 再引用 FBX 的 Mesh 子资源。

~~~text
main.scene
  └─ Prefab：cfc53c4e-7956-482b-aebc-3fb1dcd36eef
       └─ Mesh：e3553cad-2f15-4293-859a-8f43c780f289@18751
            ↑ soldier.FBX.meta 的 subMetas["18751"]
~~~

**@18751 是什么：** 它把 FBX 主 UUID 和导入器生成的子资源 ID 组合起来。它不是另一个文件路径，也不是随机后缀；运行时把完整组合当作资源身份。

## 运行代码时看什么

代码用从真实 .meta、场景和 Prefab 摘出的字段构造最小 AssetMeta 对象，再查主资源与子资源。它没有解析整份 FBX .meta，也不负责执行 Creator 的导入器。

`src/example-meta.ts` 只放本课摘录的 UUID 与字段；`src/cocos/asset/assets/AssetMeta.ts` 实现查询；`src/main.ts` 把两者连起来并显示结果。可以从 `main.ts` 的 `findSource` 调用跳进查询函数，再回到 `example-meta.ts` 看输入字段。

~~~sh
deno task check
deno task build
deno task serve
~~~

页面中先看 FBX 主 UUID，再对比 Mesh 的 @18751，最后沿场景到 Prefab 的 UUID 链确认它们不是同一个资源。

## 源码对照与下一课

- 样例数据：3.8NewProject/assets/model/helloWorld/soldier.FBX.meta、soldier.prefab、scene/main.scene。
- 引擎索引：engine/3.8.7engine/cocos/asset/asset-manager/config.ts 的 processOptions、_initUuid、_initPath、_initScene。
下一课会把这些引用画成图，并解释加载一个 Asset 时为什么还要处理它依赖的资源。
