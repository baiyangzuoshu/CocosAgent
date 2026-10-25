# Creator 2.4.15 LabelOutline / LabelShadow CLI 验收

日期：2026-10-24  
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`  
Creator：2.4.15  
CLI：0.12.59  
项目扩展：0.8.100  
目标节点：`CliAcceptanceScene/Canvas/Button/Label` (`7d017204-76ef-40cc-9a44-e4f02625012c`)

全程通过 Cocos CLI 的计划、提交、Preview、关闭和重开操作；没有使用桌面 UI 自动化，也没有手改 `.fire`/`.meta`。两个组件都依赖同节点已存在的 `cc.Label`。每次组件字段写入均经序列化读回，组件移除后节点仅保留原 Label，尺寸恢复为 `115.64×50.4`。

## LabelOutline

原 `cc.Label` 实例 ID 为 `a5mg0p4HtJXYTJ9MKrxkk0`。CLI 添加的 `cc.LabelOutline` 实例 ID 为 `e038487plCIIFYBpUz/i0R`。

| 操作 | Operation ID | 读回结果 |
| --- | --- | --- |
| 添加 `cc.LabelOutline` | `0586db5f-3f57-4e88-b941-1429be94f6a8` | 保存读回确认组件身份，场景 SHA-256 `8db9b667…f091f13a` |
| `width` 1→4 | `b654fd88-ddcd-4002-851c-e9b652493a37` | 保存读回 `width=4`、节点 `123.64×58.4`，SHA-256 `2a331560…5a4d2af9` |
| 补偿 `width` 4→1 | `8c31385d-1932-4f69-82cd-a5bd71cfa760` | 来源链接到上项；同时恢复操作前节点 `117.64×52.4`，SHA-256 `de3a8695…1209b0ce` |
| `color` 白→红 | `9a04ffb9-36e3-4ead-a698-559659f0788e` | 保存读回红色 Color，SHA-256 `8e49f426…0f9dac7c` |
| 补偿颜色 | `c86ab05e-84e6-404b-a9e0-df6a04c3245b` | 来源链接；颜色恢复白色，SHA-256 `de3a8695…1209b0ce` |
| 移除组件 | `3edf27aa-fc82-4d31-8c1f-3cc441747f6c` | 延迟读取组件销毁后的节点变换；`.fire` 回到基线 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba` 不变 |

Creator Web Preview 截图显示白色 Button 文本带红色描边，预览启动回执为 `consoleErrorCount=0`。截图：`~/.cocos-creator-agent/captures/b4b64400-97f8-4850-9174-93293cb321dd/capture-1792853040667-3b7c33.png`。

## LabelShadow

CLI 添加的 `cc.LabelShadow` 实例 ID 为 `0bzDVC5R9P6LaU/VvqbTby`。

| 操作 | Operation ID | 读回结果 |
| --- | --- | --- |
| 添加 `cc.LabelShadow` | `08f5fc62-a6de-48bb-a5d1-c353cee35118` | 保存读回组件身份，SHA-256 `a83f46a5…99e17c48` |
| `offset` `(2,2)→(8,-8)` | `c5408512-2daa-497a-b21f-8884df00d840` | 保存读回 Vec2，SHA-256 `e94632ae…da8a84a5` |
| `blur` 2→6 | `ac763d28-f0f1-402e-8090-ef6ee7dffcf5` | 保存读回 Number，SHA-256 `4c545906…5dc1c14c` |
| 补偿 `blur` | `ceb2c6f8-baad-4792-99f7-4a9bc4b3c7a6` | 来源链接；恢复 `blur=2`，SHA-256 `e94632ae…da8a84a5` |
| 补偿 `offset` | `762c18e6-5092-466d-87ad-db4a064f813b` | 来源链接；恢复 `(2,2)`，SHA-256 `a83f46a5…99e17c48` |
| 移除组件 | `edb789c3-e695-4a08-b39f-f8e30bc217cd` | `.fire` 恢复同一基线 `6430689d…b3593`；`.meta` 哈希保持不变 |

Creator Web Preview 截图显示 Button 文本下方及右侧的偏移阴影，Preview 启动时 `consoleErrorCount=0`。截图：`~/.cocos-creator-agent/captures/7add4a23-9626-4f22-8c9f-1d3a0d58c101/capture-1792853324263-42a17a.png`。

## 关闭 / 重开核验与修复

每项组件完成后均用 Cocos CLI 关闭并重开 Tank。最后一次重开回执确认工程路径、Creator 2.4.15 与扩展 0.8.100；节点读回只有原 `cc.Label`，尺寸 `115.64×50.4`。两轮组件移除的保存读回均精确回到同一 `.fire`/`.meta` 基线。

本次修复了两处布局副作用处理：属性来源补偿现在保存原操作的节点变换并在恢复字段后重置；组件移除在 Creator 延迟销毁/布局回调完成后读取实际变换，并将它作为磁盘读回预期。自动化回归覆盖两种行为；CLI 全套测试 362/362 通过。

边界：描边/阴影视觉证据覆盖此系统字体 Label 和 Web Preview；其他字体、平台渲染差异仍待验证。此记录不代表其余 UI 组件或 Prefab 任意编辑已完成。
