# 第 9 课：资源请求与缓存

**目标：** 看清同一 UUID 的第二次请求怎样复用 Asset 对象。

## 本课增量

`AssetManager.loadAny()` 把请求交给加载管线。管线先查 UUID 缓存；未命中时按配置取文件、解析并创建 `Asset`，再放进缓存。示例连续请求同一个 UUID，页面显示两次回调拿到同一对象。

## 源码位置

- `engine/3.8.7engine/cocos/asset/asset-manager/asset-manager.ts:558-573`：`loadAny` 创建请求任务并启动主管线。
- `engine/3.8.7engine/cocos/asset/asset-manager/load.ts:102-161`：单资源管线检查 UUID 缓存，命中时复用 Asset。
- `engine/3.8.7engine/cocos/asset/asset-manager/load.ts:230-238`、`utilities.ts:121-126`：加载完成后登记缓存。
- `engine/3.8.7engine/cocos/asset/assets/asset.ts`：资源对象基类。

## 简化

示例只从本地 JSON 创建一个 `Asset`。省略 `.meta`/Bundle 配置、下载与反序列化管线、依赖图及引用计数；示例的 UUID 到文件映射由 `Config` 代替。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，观察首次请求前缓存未命中、第二次请求前缓存已命中，且两次得到同一对象。
