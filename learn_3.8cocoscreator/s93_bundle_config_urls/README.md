# 第 93 课：从 Bundle Config 算出文件 URL

**本课目标：** 手工从 Creator 3.8 的 config 算出首场景 pack 和 Mesh 文件的 URL。UUID 是资源身份，URL 是文件地址；不要把它们当成同一件事。

## 先看 config 怎样连接几张表

打开 `3.8NewProject/build/web-mobile/assets/main/config.json`：

| 字段 | 怎么读 | 用途 |
| --- | --- | --- |
| `scenes` | 场景工程路径 → `uuids` 数组下标 | 找首场景下标 |
| `uuids` | 下标 → 压缩 UUID | 取资源身份 |
| `packs` | pack UUID → 它包含的 `uuids` 下标 | 判断资源在哪个 pack |
| `versions` | import/native 文件的版本数组 | 组成可选版本后缀 |
| `paths` | Bundle 内资源路径 → 下标及类型信息 | 通过名字查找普通资源 |

下标只是几张表之间传递的“行号”。它既不是 UUID，也不是文件名。

## 手算首场景的地址

1. `scenes["db://assets/scene/main.scene"]` 得到下标 `4`。
2. 读取 `uuids[4]`，得到压缩 UUID；运行时 `Config` 会把它解码成完整 UUID。
3. 在 `packs` 中找到包含下标 `4` 的 `0693a7d89`。也就是说场景序列化数据位于这个 pack。
4. 当前 `versions.import` 为空，所以本例没有版本后缀。
5. 拼出 `/assets/main/import/06/0693a7d89.json`。

`assets/main` 是 Bundle 根目录，`import` 表示序列化数据，`06` 是 pack UUID 的前两位目录，`0693a7d89` 是 pack UUID。注意文件名不是场景 UUID：一个 pack 可以包含许多 Asset。

## 手算 Mesh 子资源地址

FBX `.meta` 中的 Mesh UUID 是 `e3553cad-2f15-4293-859a-8f43c780f289@18751`。当前构建的 `config.uuids[51]` 保存它的压缩形式：

```text
压缩 UUID：e3VTytLxVCk4Waj0PHgPKJ@18751
解码 UUID：e3553cad-2f15-4293-859a-8f43c780f289@18751
文件 URL： /assets/main/native/e3/e3553cad-2f15-4293-859a-8f43c780f289@18751.bin
```

`@18751` 是 Mesh 子资源身份的一部分，解码时必须保留。因为它是独立 native 文件，所以地址使用 `native` 目录和 `.bin` 后缀，不经过 import pack 查找。

## 按代码顺序读

1. `src/example-config.ts`：场景索引和 Mesh 压缩 UUID 来自真实 config；为易读只摘了相关字段。
2. `config.ts`：`getScene()` 查场景下标，`getPack()` 查包；`getPathIndex()` 展示路径表。
3. `decode-uuid.ts`：还原压缩 UUID，并保留 `@18751`。
4. `url-transformer.ts`：`packPath()` 拼 pack 路径，`combine()` 拼 Mesh 的单文件路径。
5. `src/main.ts`：打印每一步的中间值，和 config.json 对照。

本课只实现样例用到的字段，不是完整 Bundle Config。3.8 的项目样例由 Creator 3.8.8 构建；下面的 Runtime 源码快照是 3.8.7。

## 对照 3.8.7 Runtime 源码

- [config.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/config.ts)：看 `_initUuid()`、`_initScene()`、`_initPackage()`。
- [url-transformer.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/url-transformer.ts)：看 `parse()` 和 `combine()`。
- [helper.ts](../../engine/3.8.7engine/cocos/asset/asset-manager/helper.ts)：看 UUID 压缩/解码辅助逻辑。

## 学完后自查

自己从场景路径查到数组下标、pack UUID 和最终 URL；再解释 Mesh 为什么直接用子资源 UUID 组成 native URL。下一课会把这些地址与实际 Network 请求对上。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
