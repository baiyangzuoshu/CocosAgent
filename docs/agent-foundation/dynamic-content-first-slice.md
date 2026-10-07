# 动态内容首条运行时切片

本切片使用批量导入的两张 2×2 PNG，在两版 **Web 预览**中各执行 6 轮“加载 → 显式持有 → 替换持有 → 释放旧资源”。它是资源生命周期探针，还不是游戏内容热更新系统。2.4 的载入路径是 `cc.resources.load('cocos-agent-batch-red', cc.Texture2D)`；3.8 当前图片导入类型为 texture，其子资源路径是 `resources.load('cocos-agent-batch-red/texture', Texture2D)`。两版均在新资源 `addRef()` 后才对旧资源 `decRef()`，随后调用非强制 `releaseUnusedAssets()`；清理时释放最后一份显式引用，不调用强制 `releaseAsset()`。

轨迹见 [Web 记录](traces/cocos-agent-dynamic-content-web-0.1.jsonl)，探针位于 `probes/cocos-dynamic-content-{2.4,3.8}.js`。两版每轮新纹理 `refCount=1`、缓存中且有效；旧纹理在约 250 ms 后 `refCount=0`、从资源对象缓存移除且无效；第 6 轮后清理结果相同。3.8 首次按主图片名直接加载会返回 `Bundle resources doesn't contain ...`，改用 `/texture` 子资源路径后通过。2.4 各轮墙钟耗时约 254–256 ms，其中主动等待 250 ms；3.8 除一次约 1391 ms 外约 260–282 ms，也包含等待。这些数字不能当作帧时间或吞吐量结论。

首轮探针只把当前纹理引用保存在临时节点属性上；下文追加了可见 Sprite 替换与 Mac 原生加载验证，但仍未接入实际游戏逻辑。现有结果不证明移动平台、远端下载、Bundle 热替换、运行中场景图更新、峰值内存或帧预算。下一条实现应先定义显式版本、依赖、发布路径与回滚规则。官方资源生命周期入口：[2.4 手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/release-manager.html)、[3.8 手册](https://docs.cocos.com/creator/3.8/manual/zh/asset/release-manager.html)。

## 可见对象替换的追加验证

两版 Web 预览在**仅内存存在**的临时 Sprite 上依次显示红、蓝、红、蓝纹理；[2.4 红色](traces/visual/cocos-dynamic-visible-2.4-red.png)、[2.4 蓝色](traces/visual/cocos-dynamic-visible-2.4-blue.png)、[3.8 红色](traces/visual/cocos-dynamic-visible-3.8-red.png)、[3.8 蓝色](traces/visual/cocos-dynamic-visible-3.8-blue.png)均有实际画面截图。每轮新纹理 `refCount=1`，旧纹理归零并从对象缓存移除。中途故意加载不存在的下一资源，两版均保留当前蓝色 Sprite、引用和有效性；最终销毁探针节点、释放最后持有的纹理。结构化回执见[可见替换轨迹](traces/cocos-agent-dynamic-visible-web-0.1.jsonl)。

3.8 首次设置 SpriteFrame 时，先让临时 Canvas 处于未激活状态，设置纹理后再激活，首张红色才在当前预览中可见。为防止动态合图改写临时 SpriteFrame 的纹理身份，3.8 探针设置 `packable=false`；2.4 渲染后的临时 SpriteFrame 纹理 UUID 为空，因此身份核对使用显式持有的 `Texture2D` 而非渲染帧 UUID。上述是本探针的条件，不推广为所有 UI 组件的固定初始化规则。截图在暂停的最后一帧取得，不能用于帧时间或吞吐分析。

## Mac 原生包的追加验证

两版 Creator 重新构建 Mac 包后，包内 `resources` 配置均包含红蓝纹理。临时探针 `probes/cocos-dynamic-native-mac.py` 只注入生成包入口脚本，运行后逐字节恢复。结构化轨迹分别见 [2.4](traces/cocos-agent-dynamic-native-mac-2.4.jsonl) 与 [3.8](traces/cocos-agent-dynamic-native-mac-3.8.jsonl)：两版均在场景启动后完成红、蓝、红、蓝四轮加载；当前纹理 `refCount=1` 且在对象缓存中，上一张降至 0 后无效且从缓存移除；故意加载缺失资源时错误回调触发，已持有蓝色纹理仍有效且在缓存中；最终释放后最后一张也无效且不在缓存中。

2.4 Mac 包的 `Texture2D.uuid` 在此次探针中未给出值，必须用 `_uuid` 才能按本包的实际缓存键查询；3.8 用 `uuid`。若只以 2.4 的 `uuid` 查缓存，会错误地报告“持有资源不在缓存中”。此项是当前生成包的诊断事实，不能代替资源 ID 的版本化合同。Mac 探针没有挂接可见 Sprite 或截取原生画面；画面替换仅由上述 Web 截图证明，原生轨迹证明的是加载与引用释放。
