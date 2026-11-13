# 第 93 课：Bundle Config 如何找到文件

**本课目标：** 从首场景名出发，沿 Config 索引找到 UUID、pack 和最终 URL；再把 Mesh 子资源映射到 native 文件。

## 先认 Config 里的几张表

| 字段 | 作用 |
| --- | --- |
| scenes | 场景名 → uuids 数组位置 |
| uuids | 位置 → UUID；发布配置里的 UUID 可能被压缩 |
| paths | 可寻址资源路径 → UUID 位置和类型 |
| packs | pack UUID → 它包含的 UUID |
| versions | 某些构建给资源或 pack 的版本哈希 |

3.8 的 Config 还处理 extensionMap、redirect 等字段。本课先走当前构建需要的最短路径。

## 手算首场景地址

1. settings.json 的 launchScene 是 db://assets/scene/main.scene。
2. main config 的 scenes 把它映射到位置 4。
3. uuids[4] 是压缩 UUID；解码后得到场景 UUID。
4. packs 中 0693a7d89 包含位置 4，因此场景数据在这个 pack。
5. 当前 main Bundle 的 import 文件没有版本后缀。

所以地址是：

~~~text
/assets/main/import/06/0693a7d89.json
~~~

## 手算 Mesh native 地址

Prefab 的 _mesh 字段引用 compressedUUID@18751。解码器先还原 UUID 主体，再原样保留 @18751 子资源 ID。选 nativeBase，目录取完整资源 ID 的前两位，扩展名为 .bin。

~~~text
/assets/main/native/e3/e3553cad-2f15-4293-859a-8f43c780f289@18751.bin
~~~

## URL 的拼法

~~~text
Bundle 基址 / import 或 native / UUID 前两位 / UUID + 可选版本 + 扩展名
~~~

pack 路径用 pack UUID；单资源路径用 Asset UUID。两者不要混用。当前构建 versions 为空，因此 main Bundle 的这些地址没有版本后缀。

## 对照代码和源码

- Config.getSceneIndex / getUuid / getPack：查场景索引、解 UUID、查 pack。
- decodeUuid：恢复 UUID，并保留 @ 子资源 ID。
- url-transformer.combine / packPath：分别拼单资源和 pack URL。
- 本课的构建数据摘录在 `src/example-config.ts`，`src/main.ts` 只负责按步骤查询并显示结果。
- 引擎源码：engine/3.8.7engine/cocos/asset/asset-manager/config.ts、url-transformer.ts、core/utils/decode-uuid.ts。

运行后按“场景名 → 索引 → UUID → pack → URL”顺序逐行核对。不要一开始就把压缩 UUID、完整 UUID、pack UUID 当成同一字符串。

~~~sh
deno task check
deno task build
deno task serve
~~~

## 本课边界

代码只建当前样例需要的 Config 字段，不实现全部 Bundle 重定向、扩展名、Cconb 和 URL 覆盖规则。下一课把地址映射、依赖图和缓存串起来。
