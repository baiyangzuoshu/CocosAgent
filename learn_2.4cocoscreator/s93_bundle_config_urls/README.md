# 第 93 课：Bundle Config 如何找到文件

**本课目标：** 从场景名或资源路径出发，沿 Config 索引找到 UUID、pack 和最终 URL。

## 先认 Config 里的四张表

| 字段 | 作用 |
| --- | --- |
| scenes | 场景名 → UUID 数组位置 |
| uuids | 位置 → UUID；发布构建中 UUID 可能是压缩字符串 |
| packs | pack UUID → 它包含的 UUID 数组位置 |
| versions | 资源或 pack → 文件版本哈希 |

path 表用于按项目路径找 Asset；scenes 表用于按场景名找 SceneAsset。查到 UUID 后，pack 和版本表才能继续给出文件位置。

## 手算两个真实地址

**首场景：**

1. settings 的 launchScene 是 db://assets/Scene/helloworld.fire。
2. main config 的 scenes 把这个场景映射到 uuids[0]。
3. 解码 uuids[0] 得到 SceneAsset UUID。
4. packs 中 05dd1dc0e 包含索引 0，所以场景序列化数据在这个 pack。
5. versions.import 中 05dd1dc0e 对应版本 29693。

因此文件地址是：

~~~text
/assets/main/import/05/05dd1dc0e.29693.json
~~~

**BundleMain 的 label.prefab：**

paths 中 label 对应 uuids[0]；版本表给这个资源 e273f。把 Bundle 基址、import 目录、UUID 前两位目录、UUID、版本和扩展名拼起来，得到 label.prefab 文件地址。

## URL 的拼法

~~~text
Bundle 基址 / import 或 native / UUID 前两位 / UUID + 版本 + 扩展名
~~~

贴图是 native 文件，所以选 nativeBase 并使用 .png。pack 是一组资源的合并文件，所以文件名使用 pack UUID，而不是某个单独 Asset UUID。

## UUID 为什么要解码

发布配置为了减小体积，会把 UUID 压缩成 22 个字符。运行时解码后才能用完整 UUID 查 Asset、依赖和缓存。解码示例只保留 Creator 2.4 的格式，不处理无关的数据校验和调试分支。

## 对照代码和源码

- Config.getSceneIndex / getPathEntry / getPack / getVersion：分别查场景、路径、pack、版本。
- decodeUuid：把压缩 UUID 还原成完整 UUID。
- urlTransformer.combine / packPath：选择 import/native 基址并拼接路径。
- 本课的构建数据摘录在 `src/example-config.ts`，`src/main.ts` 只负责按步骤查询并显示结果。
- 引擎源码：engine/2.4.15engine/cocos2d/core/asset-manager/config.js、urlTransformer.js、pack-manager.js。

运行后不要只看最后一行 URL。按上面的步骤逐个核对索引、UUID、pack 和版本，这样遇到地址不一致时能定位是哪张表查错。

~~~sh
deno task check
deno task build
deno task serve
~~~

## 本课边界

代码只建了当前构建所需的最小 Config 字段，不实现全部重定向、资源类型、字体和压缩包规则。下一课把地址映射、依赖图和文件/Asset 缓存串起来。
