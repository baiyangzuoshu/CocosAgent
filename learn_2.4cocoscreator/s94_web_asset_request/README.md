# 第 94 课：从场景到 Web 资源请求

**本课问题：** 首场景的资源 UUID 如何定位到 Bundle pack 和 native 文件？

## 本课内容

以当前构建的 `helloworld.fire` 为例：首场景在 `main` Bundle 的 `05dd1dc0e` pack 中；场景引用 SpriteFrame，SpriteFrame 的 `rawTextureUuid` 再指向 HelloWorld 贴图。示例输出代表性 pack/native 请求和 Asset 缓存结果。

## 源码位置

- `2.4NewProject/build/web-mobile/src/settings.f161e.js`：启动场景和 Bundle 版本。
- `engine/2.4.15engine/cocos2d/core/asset-manager/bundle.js`：`loadScene` 转入 AssetManager。
- `engine/2.4.15engine/cocos2d/core/asset-manager/config.js`、`urlTransformer.js`、`pack-manager.js`：路径、UUID、pack 与 URL。
- `engine/2.4.15engine/cocos2d/core/asset-manager/load.js`、`depend-util.js`：反序列化、依赖和缓存。
- 本课数据来自当前构建与场景/`.meta` 文件；课程里的 AssetManager 是职责模型，不是 Creator 运行时。

## 独立代码

- [端到端资源请求模型](src/cocos2d/core/asset-manager/WebAssetRequest.ts)
- [浏览器运行入口](src/main.ts)

## 运行与实际构建观察

先运行课程模型：

~~~sh
deno task check
deno task build
deno task serve
~~~

如需观察 Creator 实际 Web 请求，可另开终端进入 `2.4NewProject/build/web-mobile/` 并运行 `python3 -m http.server 8104 --bind 127.0.0.1`，再访问 <http://127.0.0.1:8104>。在 Network 面板观察 `assets/main/import/` 与 `assets/main/native/`；不要把课程模型页面的请求误认为 Creator 工程请求。
