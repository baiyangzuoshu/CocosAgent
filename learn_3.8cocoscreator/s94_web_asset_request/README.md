# 第 94 课：从场景到 Web 资源请求

**本课问题：** 首场景的资源 UUID 如何定位到 Bundle pack 和 Mesh native 文件？

## 本课内容

以当前构建的 `main.scene` 为例：场景 UUID 在 `0693a7d89` pack 中，场景引用 `soldier.prefab`，Prefab 又引用 FBX Mesh 子资源。示例输出代表性 pack/native 请求和 Asset 缓存结果。

## 源码位置

- `3.8NewProject/build/web-mobile/src/settings.json`：首场景与 Bundle 设置。
- `engine/3.8.7engine/cocos/asset/asset-manager/bundle.ts`：`loadScene` 转入 AssetManager。
- `engine/3.8.7engine/cocos/asset/asset-manager/config.ts`、`url-transformer.ts`、`pack-manager.ts`：路径、UUID、pack 与 URL。
- `engine/3.8.7engine/cocos/asset/asset-manager/load.ts`、`depend-util.ts`：反序列化、依赖和缓存。
- 本课数据来自当前 3.8.8 构建与样例资源；运行时职责对照限定在 3.8.7 源码快照。课程里的 AssetManager 是职责模型，不是 Creator 运行时。

## 独立代码

- [端到端资源请求模型](src/cocos/asset/asset-manager/web-asset-request.ts)
- [浏览器运行入口](src/main.ts)

## 运行与实际构建观察

先运行课程模型：

~~~sh
deno task check
deno task build
deno task serve
~~~

如需观察 Creator 实际 Web 请求，可另开终端进入 `3.8NewProject/build/web-mobile/` 并运行 `python3 -m http.server 8105 --bind 127.0.0.1`，再访问 <http://127.0.0.1:8105>。在 Network 面板观察 `assets/main/import/` 与 `assets/main/native/`；当前输出只有 `main` 和 `internal` Bundle。
