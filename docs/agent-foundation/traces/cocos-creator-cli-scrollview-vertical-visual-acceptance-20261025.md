# Cocos CLI ScrollView 纵向可视内容验收

日期：2026-10-25  
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`  
Creator：2.4.15  
CLI：0.12.59  
Creator 扩展：0.8.103

## 结果

纵向可视列表滚动与 View 裁切通过。首次夹具缺少有可见 SpriteFrame 的 handle，未能判断联动；后续补入临时 SpriteFrame 并以更长的自动隐藏时间重测后，垂直手柄可视、随滚动移动和空闲后隐藏均通过。测试夹具已清理，CLI 关闭/重开后场景与 `.meta` 哈希恢复基线。

## 操作与证据

所有工程操作均通过 Cocos CLI/Creator MCP 命令完成，没有使用桌面 UI 自动化。测试在 `CliAcceptanceScene` 的 `CliScrollViewTest` 下临时创建四个 Label 条目和一个垂直 Scrollbar，设置 ScrollView Content、`horizontal=false`、`vertical=true`、Scrollbar `direction=VERTICAL`、`enableAutoHide=true`、`autoHideTime=0.5`，并把 `verticalScrollBar` 指向该 Scrollbar 组件。Creator 2.4.15 `.fire` 磁盘回读确认组件引用及字段已保存。

CLI Preview 场景身份为 `CliAcceptanceScene` / `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。静止截图中，Content 的部分条目超出 View 范围；归一化坐标 `(0.76, 0.46)` 到 `(0.76, 0.30)` 的拖动后，列表向上移动，超出 View 的条目被裁切。两次 Preview 操作均未产生新增 Console 错误。

- 静止截图：`/Users/youjunmao/.cocos-creator-agent/captures/7d5ba2bf-5564-48a2-87c3-b7fbc3d06f18/capture-1792863832426-9b7610.png`，SHA-256 `eed46b320547059ba65053ddc6f3ea9e9fe8eea3e3417cc2c8925ff1c8137efa`
- 拖动后截图：`/Users/youjunmao/.cocos-creator-agent/captures/7d5ba2bf-5564-48a2-87c3-b7fbc3d06f18/capture-1792863856390-841f5b.png`，SHA-256 `fe110fc550318a6877c20f337072f96b147f5fcb8b566427c7c3043a6be9f30e`
- 拖动操作回执：`cc136b9d-ad3d-43d1-b9d2-9d21c4d50323`；断言 `no-errors` 通过。

首次组合提交遇到 Creator Label 尺寸自动重算，读回几何与请求值不一致；未重放该提交，而用独立 Transform 计划修正条目尺寸。添加 Sprite 到旧 handle 节点的组件写入未应用；随后通过场景组合创建临时 Sprite handle 和 Label 子节点，并通过 `cc.Scrollbar.handle` 的组件引用写入成功。但该 Sprite 没有可见 SpriteFrame，最终截图无法确认 handle 呈现与自动隐藏视觉行为。此项作为测试夹具/视觉验收缺口记录，不作为 CLI 属性引用写入失败。

## 清理与基线恢复

Preview 由 CLI 停止。随后通过 CLI 来源明确的属性计划清空 Scrollbar handle、ScrollView `verticalScrollBar` 和 Content 引用，并恢复 `horizontal=true`、`vertical=false`；通过 CLI 子树删除移除临时 Content 和 Scrollbar 节点。CLI 关闭和重开 Tank 后，`creator.project.info` 确认工程路径、Creator 2.4.15、扩展 0.8.103 和活动场景正确；`creator.scene.snapshot` 显示 23 个节点，ScrollView 恢复 `content=null`、`horizontal=true`、`vertical=false`、`verticalScrollBar=null`，原有独立 Scrollbar 的 `handle=null`。

Creator 保存时留下唯一序列化差异 `_N$verticalScrollBar: null`。核对确认它是相对于测试前索引版本的唯一行差异；先由 CLI 关闭工程，再从 Git 索引恢复场景文件，并再次由 CLI 重开。最终 `CliAcceptanceScene.fire` SHA-256 恢复为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。第二次 CLI 打开回执 `editorReady=true`，项目路径和版本匹配；重开后的第一次快照因实例短暂 `CREATOR_INSTANCE_BUSY` 未执行，随后重试通过，确认场景 23 个节点及 ScrollView 默认引用/方向字段。

## 2026-10-25 后续：可视手柄、联动与自动隐藏

- Creator 2.4.15 / Tank / 扩展 0.8.103。通过 `creator.asset.import.plan/commit` 导入临时 8×8 青色 PNG：Asset UUID `fdb31d88-ea16-42ed-80cb-c1902af9be6d`，SpriteFrame UUID `ad123f34-0ace-4072-a126-82c9ceb4dbce`。通过 CLI 场景组合创建垂直 Content、四个 Label、Scrollbar 和 Sprite handle，并以精确组件引用配置 `ScrollView.content`、`verticalScrollBar` 与 `Scrollbar.handle`。
- `autoHideTime=30` 时，Preview 拖动回执 `96487f51-871c-4de9-b080-df25b7712a8a` 的 `no-errors` 断言通过。拖动后截图可见青色手柄移到下方、列表内容向上移动：`/Users/youjunmao/.cocos-creator-agent/captures/1ede2dad-c921-40a2-b801-d7bbee859462/capture-1792864890012-b92659.png`，SHA-256 `9fd44e53`（前缀）。随后等待超过自动隐藏时间，截图显示手柄消失、列表仍被 View 裁切：`/Users/youjunmao/.cocos-creator-agent/captures/1ede2dad-c921-40a2-b801-d7bbee859462/capture-1792864990851-701e7b.png`，SHA-256 `feef2663f438c98cef9752ea61da2fa137a42215632b2b512de26fc2d6c4e30f`。两张图均由 Cocos CLI Preview 截取并人工检查。
- 用每个已完成属性操作的来源 ID 逐项生成补偿计划并提交，恢复 `Scrollbar.handle`、`enableAutoHide`、`autoHideTime` 及 ScrollView 的滚动方向和引用字段。CLI 删除 Content 五节点子树与 Scrollbar/handle 两节点子树；AssetDB 删除计划扫描 10 个文本资源文件，覆盖主资源及 SpriteFrame 两个 UUID，引用数为 0，再删除 PNG 与 `.meta`。
- 测试后经 Cocos CLI `project close` 关闭工程（进程退出），再由 `project open` 指定 Tank 工程并等待 `editorReady=true`。打开回执确认绝对路径、Creator 2.4.15、扩展 0.8.103。重开快照为 23 个节点，临时节点不存在，ScrollView 为 `content=null`、`horizontal=true`、`vertical=false`、`verticalScrollBar=null`；AssetDB 搜索未找到临时资源。最终 `.fire` SHA-256 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
