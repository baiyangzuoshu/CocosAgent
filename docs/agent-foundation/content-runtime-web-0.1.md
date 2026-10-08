# 已选内容版本在 Web 预览中生效：首条纵向切片

本切片把[本地内容版本合同](content-release-0.1.md)与实际 Creator Web 预览相连。Host 在当前项目暂存红、蓝两个不可变版本，逐次修改 `selected.json`；验收宿主读取选中记录并交给运行时适配器。运行时按各版路径加载纹理、`addRef()`、创建 SpriteFrame、切换可见 Sprite，等一次 `EVENT_AFTER_DRAW` 后才销毁旧 SpriteFrame、`decRef()` 旧纹理并调用非强制 `releaseUnusedAssets()`。成功回执包含版本指纹、资源 UUID 与当前引用数；Host 的 `content.runtime.accept` 再核对当前选中版本、指纹、资源身份与有效引用数，单独写 `effective.json`。`selected` 表示 Host 想应用的版本，`effective` 表示本地验收宿主收到并核对的运行时成功回执。

实现分层：`tools/cocos-agent-bridge/runtime/content-swap-core.js` 管持有、替换和失败保留；两版示例分别在 `assets/Script/CocosAgentContentRuntime.js`、`assets/CocosAgentContentRuntime.js` 保存版本适配器；`probes/cocos-content-runtime-{2.4,3.8}.js` 和 `probes/cocos-content-runtime-live.mjs` 是较早的临时注入验收。2.4 通过 `cc.resources.load(图片名, cc.Texture2D)` 与 `_uuid` 识别纹理；3.8 用 `resources.load(图片名/texture, Texture2D)` 与 `uuid`。两版编辑器已导入适配器并生成 `.meta`。

2026-10-08 两版实际预览均完成：红版 `applied`、蓝版 `applied`；强制下一次红纹理加载失败时返回 `retained`，活动 Sprite 与 `effective` 仍为蓝版；Host 把 `selected` 回退到蓝版后再次选择红版，运行时成功应用并收到新的 `effective` 回执。画面证据：[2.4 红](traces/visual/cocos-content-runtime-2.4-red.png)、[2.4 蓝](traces/visual/cocos-content-runtime-2.4-blue.png)、[3.8 红](traces/visual/cocos-content-runtime-3.8-red.png)、[3.8 蓝](traces/visual/cocos-content-runtime-3.8-blue.png)。原始结构化回执：[2.4](traces/cocos-agent-content-runtime-2.4-web.json)、[3.8](traces/cocos-agent-content-runtime-3.8-web.json)。测试结束，探针节点销毁，两个示例中的临时 Host 版本文件和指针均已删除；主场景文件未变化。

## 2.4 正常启动通道验收

2026-10-08，2.4 示例通过 `HelloWorld.onLoad` 正常启动运行时适配器和 `CocosAgentRuntimeChannel`，不需要向预览注入源码。Host 只绑定 `127.0.0.1`，限定预览 Origin 和一次性随机令牌；游戏客户端只读取本地预览 URL 参数并通过 WebSocket 请求发布版本。实测红、蓝两次切换后的截图中心像素分别为 `255,0,0`、`0,0,255`，Host 收到各自 `applied` 回执并更新 `effective`。之后主动关闭客户端 socket，客户端自动重连，Host 重发蓝版，运行时回复 `already-active`，截图仍为蓝色。完整轨迹见 [2.4 通道验收 JSON](traces/cocos-agent-content-channel-2.4-web.json)；可重复脚本为 `probes/cocos-content-runtime-channel-live.mjs 2.4`。

失败回退由两部分验证：运行时核心单测确认加载失败或绘制确认失败时保留原 SpriteFrame；Host 通道测试确认失败回执不覆盖上一个成功的 `effective` 版本。失败注入尚未在正常启动的 2.4 Creator Web 预览中完成。Web 通道不代表原生包、远端内容分发或性能预算已经验收。

正常启动通道仅完成 2.4 Web 预览验证；3.8 保留较早的临时注入轨迹，尚无项目启动接线验收。该 Host 本机通道没有外部用户认证能力，令牌只用于本机开发预览；URL 中的令牌不可复用于模型凭证或公开部署。一次绘制确认与截图只证明本次 Web 画面可见，不给出帧预算或所有平台的 GPU 完成保证。Mac 原生包此前只验证纹理加载/释放，动态版本生效与运行时通道仍未在原生包验收。
