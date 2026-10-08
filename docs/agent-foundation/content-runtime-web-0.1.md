# 已选内容版本在 Web 预览中生效：首条纵向切片

本切片把[本地内容版本合同](content-release-0.1.md)与实际 Creator Web 预览相连。Host 在当前项目暂存红、蓝两个不可变版本，逐次修改 `selected.json`；验收宿主读取选中记录并交给运行时适配器。运行时按各版路径加载纹理、`addRef()`、创建 SpriteFrame、切换可见 Sprite，等一次 `EVENT_AFTER_DRAW` 后才销毁旧 SpriteFrame、`decRef()` 旧纹理并调用非强制 `releaseUnusedAssets()`。成功回执包含版本指纹、资源 UUID 与当前引用数；Host 的 `content.runtime.accept` 再核对当前选中版本、指纹、资源身份与有效引用数，单独写 `effective.json`。`selected` 表示 Host 想应用的版本，`effective` 表示本地验收宿主收到并核对的运行时成功回执。

实现分层：`tools/cocos-agent-bridge/runtime/content-swap-core.js` 管持有、替换和失败保留；`probes/cocos-content-runtime-{2.4,3.8}.js` 分别映射版本 API；`probes/cocos-content-runtime-live.mjs` 在同一个隔离 Chrome 预览中驱动 Host 选择、运行时应用、截图和回执读回。2.4 通过 `cc.resources.load(图片名, cc.Texture2D)` 与 `_uuid` 识别纹理；3.8 用 `resources.load(图片名/texture, Texture2D)` 与 `uuid`。版本适配器仅在测试时注入预览进程，示例主场景与源脚本没有持久挂载。

2026-10-08 两版实际预览均完成：红版 `applied`、蓝版 `applied`；强制下一次红纹理加载失败时返回 `retained`，活动 Sprite 与 `effective` 仍为蓝版；Host 把 `selected` 回退到蓝版后再次选择红版，运行时成功应用并收到新的 `effective` 回执。画面证据：[2.4 红](traces/visual/cocos-content-runtime-2.4-red.png)、[2.4 蓝](traces/visual/cocos-content-runtime-2.4-blue.png)、[3.8 红](traces/visual/cocos-content-runtime-3.8-red.png)、[3.8 蓝](traces/visual/cocos-content-runtime-3.8-blue.png)。原始结构化回执：[2.4](traces/cocos-agent-content-runtime-2.4-web.json)、[3.8](traces/cocos-agent-content-runtime-3.8-web.json)。测试结束，探针节点销毁，两个示例中的临时 Host 版本文件和指针均已删除；主场景文件未变化。

这是**本机测试宿主携带选中记录**的接线，不是游戏进程主动连接 Host；`content.runtime.accept` 当前接受本地调用者提供的回执，尚无运行时连接身份认证或截图自动校验，不能当作远程客户端的可信证明。一次 `AFTER_DRAW` 和截图说明这次 Web 画面可见，不给出帧预算或所有平台的 GPU 完成保证。Mac 原生包此前只验证了纹理加载/释放；本版运行时核心、版本切换、Host 生效回执、失败回退尚未在原生包验收。项目化接入下一步应把版本适配器作为正式游戏组件或启动模块挂接，并设计宿主到运行时的受控本地通道；再分别验证原生画面、内存峰值与帧时间。
