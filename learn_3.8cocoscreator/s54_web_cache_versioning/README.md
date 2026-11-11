# 第 54 课：Web 缓存与版本更新

**本课问题：** Creator Web 发布后，怎样切换版本并避免入口和资源继续使用旧内容？

## 核心流程

本例让 `/index.html` 和 `/release.json` 使用 `Cache-Control: no-cache`：浏览器可以保存文件，但使用前要向服务器重新验证。每次发布把资源放入新的 `/releases/<版本>/` 目录，并为这些不变的 URL 设置长缓存和 `immutable`。先上传并核验新目录，再替换 `release.json`；旧目录保留用于回滚。

## 源码位置

- [IConfigOption 保存 Bundle 基址与版本索引](../../engine/3.8.7engine/cocos/asset/asset-manager/config.ts#L30)。
- [url-transformer.combine 组合资源 URL](../../engine/3.8.7engine/cocos/asset/asset-manager/url-transformer.ts#L190)。
- [Creator 3.8 发布与原生构建边界](../../docs/3.x/10-publishing-and-native.md#L1)：完整构建器不在本地引擎源码中。
- 前置课：[第 52 课：资源处理与产物结构](../s52_resource_artifacts/README.md)、[第 53 课：启动与交付](../s53_startup_delivery/README.md)。

独立代码对应 `cocos/asset/asset-manager/url-transformer.ts` 的 URL 组合职责；`deploy/` 单独表示发布清单和 HTTP 缓存策略。本例只是课程代码与源码静态映射，没有 Creator 编辑器或发布包验收。

## 简化范围

`release.json` 和 Nginx 规则是教学用部署示例，不是 Creator 自动生成的产物。课程不接入真实 Builder、CDN 或缓存清除服务。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

页面会读取 `release.json`，显示资源 URL、缓存策略、发布顺序和回滚目标。Nginx 示例见 [deploy/nginx.conf](deploy/nginx.conf)。
