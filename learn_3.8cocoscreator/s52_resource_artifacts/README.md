# 第 52 课：资源处理与产物结构

**本课问题：** Creator 3.8 的 Bundle 元数据怎样定位导入数据与原生资源？

## 观察结果

`Config` 读取 `base`、`importBase`、`nativeBase`、资源索引和版本表；URL 组装器依资源类型选择导入或原生目录，再用 UUID、版本和扩展名定位文件。3.8 还允许资源映射覆盖 UUID，且导入扩展名可由配置提供。

## 源码位置

- [`IConfigOption` 与 `Config.init`](../../engine/3.8.7engine/cocos/asset/asset-manager/config.ts#L30)；[`getAssetInfo` 查 UUID 索引](../../engine/3.8.7engine/cocos/asset/asset-manager/config.ts#L314)。
- [`url-transformer.combine` 选择基址并生成 URL](../../engine/3.8.7engine/cocos/asset/asset-manager/url-transformer.ts#L190)；[Bundle 配置版本说明](../../engine/3.8.7engine/cocos/asset/asset-manager/asset-manager.ts#L694)。
- [编辑器导入与生成产物的证据边界](../../docs/3.x/04-assets-and-loading.md#L7)。

独立代码：[Bundle 文件映射模型](src/asset/BundleFileLayout.ts) 和 [浏览器输出](src/main.ts)。

## 简化范围

示例只映射运行时配置到文件 URL，UUID、版本和目录均为占位值；不重建 Builder 或验证 Creator 3.8 编辑器产物，也没有编辑器/运行时验收。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000` 查看示例 URL。
