# 第 0 课：`.meta` 元数据与 UUID

**目标：** 从 Creator 2.4 的贴图 `.meta` 中区分 Texture 主资源和 SpriteFrame 子资源，并验证复制、删除和重新导入时身份如何变化。

## 先看真实 `.meta`

打开 `2.4NewProject/assets/Texture/HelloWorld.png.meta`，重点看这些字段：

| 字段 | 本例中的值 | 含义 |
| --- | --- | --- |
| 顶层 `uuid` | `6aa0aa6a-ebee-4155-a088-a687a6aadec4` | PNG 导入后 Texture 主资源的身份 |
| `subMetas.HelloWorld.uuid` | `31bc895a-c003-4566-a9f3-2e54ae1c17dc` | 从贴图导出的 SpriteFrame 子资源身份 |
| `subMetas.HelloWorld.rawTextureUuid` | `6aa0aa6a-ebee-4155-a088-a687a6aadec4` | SpriteFrame 所依赖的 Texture 主资源 |
| `importer` / `type` | `texture` / `sprite` | 说明由哪种导入器按哪种资源类型处理 |
| `ver` | `2.3.7` | `.meta` 配置版本，不是 Creator 引擎版本 |

因此，“图片资源 UUID”通常指顶层 UUID；场景中 Sprite 的 `spriteFrame` 引用则可能指向 SpriteFrame 子 UUID。两者不是同一个资源身份。

## UUID 什么时候变化

Creator 2.4 手册说明：新建 `.meta` 时会随机生成 UUID；`.meta` 由编辑器 AssetDB 管理。复制图片时，图片和 `.meta` 一起复制会保留原身份；只复制图片、不带 `.meta`，重新导入时会创建新的 `.meta` 和资源身份。[Meta 文件参考](https://docs.cocos.com/creator/2.4/manual/en/extension/reference/meta-reference.html) · [资源工作流](https://docs.cocos.com/creator/2.4/manual/en/asset/asset-workflow.html)

本次对同一张 `map_bg_1.png` 的三次观察如下：

| 观察 | 顶层 Texture UUID | SpriteFrame UUID |
| --- | --- | --- |
| 第一次 | `09830c38-c4ad-4afb-8973-2cd390084091` | `215aacac-6d27-40b1-aca0-9ed2d2de7ef9` |
| 复制后的另一份 `.meta` | `9bca51b6-e7e8-4a1d-ad15-8cda2c677767` | `086baa6d-065d-44a1-b112-1762e5489da9` |
| 删除资源后重新导入 | `c49f3512-e2dc-4919-9fbf-6ff348e5d02b` | `ea859079-7a4d-45d0-84b4-408bafef3e3c` |

三份 `.meta` 的图片尺寸和导入设置相同，两个层级的 UUID 都不同。这说明新建 `.meta` 时的 UUID 不是由图片内容或文件名固定算出的。若删除后又出现原 UUID，先确认旧 `.meta` 确实不存在、重新导入时没有把它一起复制回来；Creator 2.4 手册建议在操作系统文件管理器中改动资源前关闭编辑器。仅凭“UUID 相同”这一现象，不能断定 AssetDB 恢复旧数据的具体机制。

## 本课必须保留的机制

区分 Texture 顶层 UUID 与 SpriteFrame 子资源 UUID，并确认 `rawTextureUuid` 指回顶层 Texture；`.meta` 的 `ver` 也不能与 Creator 引擎版本混淆。

## 最小观察宿主

`deno task analyze` 读取从真实 `.meta` 抽取的字段子集，只输出主资源/子资源 UUID 关系和 `rawTextureUuid` 对照；无需启动浏览器 Runtime。上面的 `map_bg_1.png` 三次 UUID 表是此前记录的导入观察，不是脚本现场重新生成的结果。

## 模型化简化与 Creator Runtime 边界

样例 JSON 不是可直接导入 Creator 的完整 `.meta`。本地 `engine/2.4.15engine/` 是 Runtime 快照，不包含 Creator 编辑器 AssetDB 导入器实现；可依据官方手册说明新建 `.meta` 时随机生成并记录导入观察，但不能断言随机算法或 AssetDB 如何检测/处理 UUID 碰撞。Runtime 不读取编辑器 `.meta`，构建过程会整理资源信息进运行时配置。

## 本课代码与源码位置

运行样例会打印顶层 UUID、子资源 UUID，以及 `rawTextureUuid` 是否指回顶层资源。样例 JSON 是从真实 `.meta` 中抽取的字段子集，不是可直接导入 Creator 的完整文件。

- `samples/HelloWorld.png.meta.sample.json`：本课读取的精简字段样例。
- `docs/2.x/04-assets-and-loading.md:11-13`：记录 `HelloWorld.png.meta` 主 UUID、SpriteFrame 子 UUID 和 `rawTextureUuid`。
- `engine/2.4.15engine/cocos2d/core/asset-manager/config.js:177-198`：Runtime Config 按路径查找构建后的资源信息；不是 `.meta` UUID 生成代码。
- `engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js:486-493`：`loadAny` 把请求交给 Asset Manager 管线。

Web 运行时不读取编辑器 `.meta`；构建过程把资源信息整理进运行时配置。完整加载过程见第 89–94 课。

## 运行

~~~sh
deno task check
deno task analyze
~~~

预期输出包含主资源 UUID `6aa0…`、SpriteFrame UUID `31bc…`，并显示 `rawTextureUuid` 指回主贴图。浏览器宿主准备见课程入口的“运行准备”。
