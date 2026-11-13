# 第 90 课：`.meta` 与资源身份

**本课问题：** FBX 主 UUID、导入子资源 UUID 和场景里的 Prefab 引用怎样连起来？

## 本课内容

从 `soldier.FBX.meta` 读取主 UUID 与 Mesh、Skeleton、Animation 子 UUID，再核对场景引用的 `soldier.prefab` UUID。3.8 的 Bundle 归属由项目 Bundle 配置控制；目录 `.meta` 本身不再像 2.4 那样保存 `isBundle`。

## 源码位置

- `3.8NewProject/assets/model/helloWorld/soldier.FBX.meta`：FBX 主 UUID、子资源 ID 和导入设置。
- `3.8NewProject/assets/model/helloWorld/soldier.prefab`、`3.8NewProject/assets/scene/main.scene`：Prefab 与场景 UUID 引用。
- `3.8NewProject/assets/BundleMain.meta`：目录身份；本样例此文件没有 Bundle 配置数据。
- `engine/3.8.7engine/cocos/asset/asset-manager/config.ts:244-268`：运行时 Config 建立 UUID、路径、Bundle 索引。
- 3.8 编辑器 AssetDB 导入器未包含在运行时源码快照中；编辑器工作流以 3.8.8 项目设置和 `.meta` 为证据。

## 独立代码

- [资源元数据模型](src/cocos/asset/assets/AssetMeta.ts)
- [场景引用查找](src/main.ts)

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://127.0.0.1:8000>，观察 FBX 主资源、导入子资源与场景 Prefab 的身份区别。
