# 第 93 课：从 Bundle Config 算出文件 URL

**本课目标：** 手工从 2.4 的 Bundle config 算出场景 pack 和 PNG 的 URL。先明确：UUID 是身份，URL 是文件地址；它们不是同一个字符串。

## 先看 config 是一组索引表

打开 `2.4NewProject/build/web-mobile/assets/main/config.a9f01.json`，本课只需要四个字段：

| 字段 | 怎么读 | 用途 |
| --- | --- | --- |
| `scenes` | 场景工程路径 → `uuids` 数组下标 | 找首场景下标 |
| `uuids` | 下标 → UUID（发布时可能压缩） | 取资源身份 |
| `packs` | pack UUID → 它包含的数组下标 | 判断资源是否打进 pack |
| `versions` | 文件身份 → 版本后缀 | 组成带版本的文件名 |

这里的下标是连接几张表的“行号”。例如 `scenes` 返回 `0`，表示下一步去读 `uuids[0]`，不是 UUID 本身。

## 手算首场景的 pack URL

跟着真实 `config.a9f01.json` 做一遍：

1. `scenes["db://assets/Scene/helloworld.fire"]` 得到下标 `0`。
2. `uuids[0]` 是压缩场景 UUID。运行时 config 会解码它；课程代码在 `Config.getUuid()` 中做这一步。
3. 查 `packs`，发现 `05dd1dc0e` 的数组包含下标 `0`，所以场景数据在这个 pack。
4. `versions.import` 中 `05dd1dc0e` 后面的值是 `29693`，它作为版本后缀。
5. 拼出：`/assets/main/import/05/05dd1dc0e.29693.json`。

拆开这个地址看：`assets/main` 是 Bundle 目录，`import` 是资源数据类型，`05` 是 pack UUID 的前两位目录，`05dd1dc0e` 是 pack UUID，`.29693` 是版本号，`.json` 是本版 pack 文件格式。

## 再手算一个 PNG URL

`uuids[1]` 是 HelloWorld.png 对应的 Texture2D UUID。查 `versions.native`，索引 `1` 对应版本 `a4b27`。它不是 pack，因此拼单资源地址：

```text
/assets/main/native/6a/
6aa0aa6a-ebee-4155-a088-a687a6aadec4.a4b27.png
```

注意：场景引用的是 SpriteFrame 子 UUID；这里请求 PNG 用的是 Texture2D 主 UUID。第 90 课已说明两者由 `rawTextureUuid` 连接。

## 按代码顺序读

1. `src/example-config.ts`：只摘取本课需要的数组和表；完整 config 不必抄进课堂代码。
2. `config.ts`：`getScene()`、`getUuid()`、`getPack()`、`getVersion()` 分别完成上面的查表步骤。
3. `decodeUuid.ts`：把发布配置中的压缩 UUID 解回完整身份。
4. `urlTransformer.ts`：`packPath()` 和 `combine()` 将查到的值拼成 URL。
5. `src/main.ts`：打印每个中间值，便于逐步和 config 文件比对。

课程代码不是 Creator 的完整 Config：它省略重定向、扩展名规则和其他请求类型，只保留本例走到的字段。

## 对照 2.4.15 Runtime 源码

- [config.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/config.js)：看 `_initScene()`、`_initUuid()`、`_initPackage()`、`_initVersion()` 如何准备查询表。
- [urlTransformer.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/urlTransformer.js)：看 `parse()` 怎样找资源地址、`combine()` 怎样组成 URL。
- [helper.js](../../engine/2.4.15engine/cocos2d/core/asset-manager/helper.js)：搜索 `decodeUuid`。

## 学完后自查

不看课程输出，自己从 `scenes` 查到 pack UUID，再用 `versions.import` 拼出文件名。然后解释：为什么场景的 import pack URL 不等于场景 UUID？下一课会观察真实浏览器请求。

运行方式：在本课目录执行 `deno task check`、`deno task build`、`deno task serve`。
