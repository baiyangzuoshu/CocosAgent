# Cocos CLI ScrollView 与 Scrollbar 运行时验收

日期：2026-10-25  
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`  
Creator：2.4.15  
CLI：0.12.59  
Creator 扩展：0.8.101

## 验收过程

通过 Cocos CLI 在现有 `CliAcceptanceScene` 创建临时 Content、Scrollbar handle 和测试 SpriteFrame，配置水平 `cc.ScrollView`，并把 Scrollbar 组件设为其水平滚动条。测试夹具关闭惯性和回弹，Scrollbar 关闭自动隐藏，以便观察手势和手柄位置。所有场景/资源修改、Preview 操作、关闭和重开均由 Cocos CLI 发起；没有使用桌面 UI 自动化。

Creator Web Preview 中先把鼠标从画布归一化坐标 `(0.82, 0.344)` 拖到 `(0.70, 0.344)`，再反向拖回。运行时断言读得 Content 本地 x 从 `0` 到 `-115`，Scrollbar handle 本地 x 从 `-40` 到 `6`；反向拖动后两项均恢复初值。前向拖动截图显示内容色带已滚动、水平 handle 同步移动。Preview Console 错误数为 0，数值断言及 `no-errors` 检查通过。

截图：`/Users/youjunmao/.cocos-creator-agent/captures/02025a0d-f466-4bff-9ed0-0c202caf52cc/capture-1792856627411-6105f7.png`  
SHA-256：`601ef926f82c8da03842baf2070fbb66b9123a04a13802ca944b14c739e295a3`

## 清理与重开核验

所有临时属性和节点均通过其已完成操作的来源补偿恢复；临时纹理和 SpriteFrame 先经 AssetDB 引用扫描，再由 CLI 删除。Creator 2.4.15 Tank 的 `.fire` 哈希恢复为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 哈希恢复为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。CLI 关闭并重开工程后，`creator.project.info` 确认项目路径、Creator 版本、活动场景及扩展版本；`creator.scene.snapshot` 确认场景有 23 个节点且没有临时 ScrollView 子树；两个文件哈希仍与基线一致。

## CLI 修复

清理时发现，把 `cc.ScrollView.horizontalScrollBar` 清为 null 后，Creator 会在旧 `cc.Scrollbar` 上保留序列化的 `_scrollView` 指针。CLI 现在在旧组件的反向目标仍指向当前 ScrollView 时调用 Creator 的 `setTargetScrollView(null)`，并核对运行时指针已清除；替换引用时同样先解除旧关联。测试覆盖了清除滚动条引用时反向目标同步清空。

扩展随该行为修复从 0.8.100 升到 0.8.101。`node --test tools/cocos-creator-agent-cli/test/scene-component.test.mjs` 通过，42 项测试全通过。更新后的扩展已由 CLI 安装到 Tank，CLI `extension status` 显示与仓库模板匹配、无文件漂移，随后完成全工程关闭/重开。

涉及实现及测试：

- `tools/cocos-creator-agent-cli/creator-extension/scene.js`
- `tools/cocos-creator-agent-cli/test/scene-component.test.mjs`

本记录只覆盖 Creator 2.4.15 Tank 的水平滚动及滚动条联动；ScrollView 事件、纵向滚动、惯性/回弹边界和 Scrollbar 垂直方向仍待单独验收。
