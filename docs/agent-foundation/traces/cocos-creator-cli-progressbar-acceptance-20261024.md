# Creator CLI ProgressBar 属性往返验收（2026-10-24）

## 目标与身份

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15；扩展：0.8.72
- 场景：`CliAcceptanceScene`，scene UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliProgressBarTest`，node UUID `60b93f4f-8329-4619-83c5-365bbf50e9df`
- 组件：`cc.ProgressBar`，component UUID `9audFc1QZHOacPs9VtFhB1`

## 写入、运行时检查与补偿

1. 原始值 `progress=0.5`；场景 `.fire` SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
2. CLI 计划/提交 `progress=0.5→0.75`：operation `3c33a908-b067-4d00-9065-f2441a8a1fe2`，plan hash `545feb081973a5bc4bb0a19cc815a1f1b0f69a4efab631193d50f38190f457e4`。Creator 磁盘读回确认同一组件 UUID、序列化键 `_N$progress` 和值 `0.75`；场景 SHA-256 变为 `3c2d6a46436f5608acbc6ee30d0ef942661806430d198f0619ebf2dfeefef008`，`.meta` 不变。
3. 扩展 CLI 预览断言的安全字段读取映射：只从 Creator 实例自身 `_N$progress` 数据字段读取，不调用 `progress` getter。Creator 2.4.15 源码将该属性声明为 0–1 范围的数值字段；单测用抛错 getter 确认断言不会执行组件 getter。
4. CLI 预览会话 `4e910b70-1f2a-4a8a-a44d-d27be1bbc38d` 中，场景 UUID、无新增运行时错误和 `cc.ProgressBar.progress===0.75` 三项断言通过。断言之前识别到桥接服务仍载入旧模块；通过 CLI 停止预览、停止桥接并以工作区 CLI 重启后重新开预览，才得到通过回执。
5. CLI 关闭并重开后，Creator 2.4.15 / 扩展 0.8.72 握手成功，实例 `421b68d1-9f05-4df5-a5c7-8fb1ab2a060d` 的场景快照读回 `progress=0.75`。
6. CLI 计划/提交来源补偿 `0.75→0.5`：operation `f2c1c36a-262f-40d8-bdf0-7af2f2fce03f`，plan hash `d2ee5dac30dbda386741e197df6fed3fbacaf1ae9c1dbbb7e9f0d8f8ca934b9b`。保存读回确认 `_N$progress=0.5`，场景 SHA-256 回到原基线，`.meta` 未变。
7. 补偿后再由 CLI 关闭并重开。实例 `b75619d1-17a0-48ed-945b-6e7fa59a0487` 返回工程路径、Creator 版本、扩展版本和场景身份；场景快照读回 `progress=0.5`，两个哈希仍为原基线。

## 结果边界

`cc.ProgressBar.progress` 标量属性在 Creator 2.4.15 中已完成 CLI 计划、提交、运行时属性断言、关闭重开读回、来源补偿和再次重开验收。本夹具的 `barSprite` 为空，因此没有可见填充资源，本轮不宣称进度条的实际图形呈现通过。没有桌面 UI 自动化。

## 水平可视填充验收补充（2026-10-25）

- 实例：工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15，扩展 0.8.103，CLI 0.12.59；场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。
- 临时 PNG 由测试脚本生成，导入前 SHA-256 `5090f3ad8fdea7868257a1f3429d16d5d777e98167774921f1f671707ebbbade`。Creator AssetDB 导入 operation `00efdc90-d19b-4cde-adc8-5e60905f36ae`，主资源 UUID `31c1df36-0dce-4ee3-ad0e-6f1e4ac5188b`，SpriteFrame UUID `442d9b90-a532-4b15-963f-dd92ae0a7478`。
- CLI 场景组合 operation `f57bf13c-4f71-4687-8c28-17d4a6857595` 创建临时 Sprite 子节点 UUID `99387fe5-10f8-407f-946f-5796a8cac81b`；`cc.ProgressBar.barSprite` 引用 operation `7db5230c-65c5-452b-b05e-9c34003dc0bd` 通过精确组件引用写入，并从 `.fire` 读回核实。ProgressBar 自动把目标节点总长度从 1 更新为 Sprite 宽度 180，并把节点高度更新为 32。
- Web Preview 会话 `d2d101ae-0521-4084-b14e-23e17a594535`，浏览器画布 960×640。CLI 断言确认初始 `progress=0.5` 时填充节点宽 90，`progress=0.75` 时宽 135；两次场景 UUID、组件字段、宽度和 `no-errors` 断言均通过。截图：50% SHA-256 `800738790596e149365e885c29d6c165dae33ed99a38b744434495b9bb36bbf9`；75% SHA-256 `9a6c045db71dcfc7f770fa75bd319790eb6677c4039e2db7d5b06fbec06ddea5`。
- 75% 进度通过来源补偿 operation `42d3bc74-4bc4-4f93-86e4-9471dc5e10fd` 恢复到 0.5。清除 `barSprite` 的来源补偿 operation `57bba5eb-d0f0-4cc1-967b-6fee6760fa8f` 同时恢复了 ProgressBar 节点高度 40，但 Creator setter 留下 `totalLength=180`；CLI 随后将该字段从 180 改回原始默认 1，operation `0a667b91-f5ad-47cf-89a7-e201bc2f22f5`。这是本次发现的补偿边界：组件引用 setter 会带来额外序列化副作用，当前补偿计划只恢复相关节点变换，不自动恢复此派生字段。
- 临时子节点通过精确 CLI 删除 operation `933a3f2a-1ba4-4eb0-81d8-73744bc8b673` 清理。贴图及其 SpriteFrame 子资源经完整引用扫描（10 个文本文件，0 条引用）后通过 AssetDB 删除 operation `b4ad0101-ae4d-4064-81f7-0e810f829e4d` 移除。
- Cocos CLI 关闭 Creator PID 4937 并重开同一工程，Creator 2.4.15、扩展 0.8.103 握手成功。重开后场景 23 节点；ProgressBar `barSprite=null`、`mode=0`、`totalLength=1`、`progress=0.5`、`reverse=false`，目标子节点不存在，临时贴图 AssetDB 查询为空。最终 `.fire` SHA-256 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，与记录基线一致。
- 此证据只覆盖 Creator 2.4.15 Web Preview 的水平、非反向、SIMPLE Sprite 填充及 50%/75% 数值。反向、垂直和 FILLED 模式，背景轨道及其他目标平台仍待验收。全程使用 Cocos CLI 和其 Preview 接口，没有使用桌面 UI 自动化。

## 反向、垂直与 FILLED 模式验收补充（2026-10-25）

- 实例：Tank 工程，Creator 2.4.15、扩展 0.8.103、CLI 0.12.59；场景 UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`；ProgressBar 节点 UUID `60b93f4f-8329-4619-83c5-365bbf50e9df`，组件 ID `9audFc1QZHOacPs9VtFhB1`。全程只调用 Cocos CLI/MCP 和 CLI Preview。
- 本轮临时贴图主资源 UUID `e516c76b-37bc-4b23-9872-7449bc777feb`，SpriteFrame UUID `1ffaf05e-a315-4322-88c2-80fcc4227c15`；临时子节点 UUID `921d29cb-4539-4949-874b-3ea1e07242f0`，Sprite 组件 ID `502416nyZPXr3b8SRhitd/`。设置 `barSprite` operation `3b130365-73ae-4c6b-af43-391c600a70c1`。
- **垂直 SIMPLE：** ProgressBar `mode=1`、`progress=0.5`、`totalLength=32` 时，Preview 中子 Sprite `180×16`；改为 `progress=0.75` 后为 `180×24`。两次的场景、节点尺寸、ProgressBar 进度及 `no-errors` 断言通过。50% 截图 SHA-256 `56382bc7d7e3bf7e28f2e46c795424669efa0799e32846ab240ed921a23c9aff`。
- **垂直反向：** 75% 时将 `reverse=true`，保存读回子 Sprite `anchorY=1`、高度 24；Preview 对锚点、高度、进度及 `no-errors` 的断言通过。截图 SHA-256 `2089486a8d62a918041fe57bf8149fed5b1702d2453b615fcdc8b69f14762d20`。运行时 Preview 断言器不支持读取 ProgressBar `reverse` 字段，因此反向字段以 CLI 写入/磁盘读回和顶端锚点变化共同确认。
- **FILLED 水平：** 设置 Sprite `type=3 (FILLED)`、`fillType=0 (HORIZONTAL)`、ProgressBar `mode=2 (FILLED)`、`reverse=false`。ProgressBar `progress=0.75` 和 `0.25` 的 Preview 运行时进度断言与 `no-errors` 均通过，截图分别显示约 75% 和 25% 填充，SHA-256 分别为 `fdc3094b196998d8a80f40cad9071a6b6649ee2c400a27d2cf3aaa870091dda6` 与 `b37a2fa35b8e103869aa5109aec414f8abfe8d53fe67b2973ed6cdd75a35d310`。Creator UI Inspector 读回 Sprite `type=3`、`fillType=0`，并在两档进度下分别读回 `fillRange=0.75`、`0.25`。Preview 的声明式断言器不能读取 `cc.Sprite.fillRange`（返回 `null`），故该字段以 CLI Inspector 读回为准，视觉变化以 Preview 截图为准。
- 代表性操作：垂直模式 `d0c4d32d-6e19-488c-89ee-48b80ce50908`；垂直反向 true/false `1b9de2fc-d8b9-4f26-a6dc-500334c11b9d` / `e2e87925-8460-4f42-9cc4-331d1385d604`；FILLED Sprite type、ProgressBar mode、totalLength=1 分别为 `a6bba5a9-e29f-4cff-8516-f424e7dbe86d`、`a37a3a8f-4358-48bc-a4de-677c5deed178`、`99ccf96f-f195-4c74-825a-e0f653f7acd3`；25% 进度 operation `080f2ea9-1a16-4e1b-9aec-34a74ab142e7`，其来源补偿为 `2e7ebc79-1c97-4084-8688-b02177943a42`；75% 进度恢复原值 operation `37df49b8-2770-486f-af30-89a2727d5cc8`。
- **补偿观察：** 把 FILLED mode 来源补偿回垂直 mode 时，Creator setter 根据子 Sprite 当前高度 24 自动把 `totalLength` 改为 24；来源补偿不会恢复这个派生值。CLI 读回后显式把 `totalLength` 恢复为 32，再按来源逆序补偿两次长度修改，并清除 `barSprite`。最终显式恢复 `mode=0`、`totalLength=1`、`progress=0.5`、`reverse=false`。贴图经完整引用扫描并由 AssetDB 删除，临时节点由 CLI 删除。
- 关闭/重开前后均由 CLI 确认 Creator 2.4.15、扩展 0.8.103、同一工程路径；重开后场景 23 节点，目标临时节点不存在，AssetDB 对 `CliProgressBarFillModes` 搜索返回 0 项。Inspector 读回 ProgressBar `mode=0`、`totalLength=1`、`progress=0.5`、`reverse=false`、`barSprite=null`。最终 `.fire` SHA-256 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，均与基线一致。
- 本轮尚未覆盖 Sprite `fillType=VERTICAL/RADIAL`、有背景轨道的视觉效果或非 Web 目标平台。另发现 `creator.scene.node.set-transform.plan` 若在变更列表中包含未变化字段（本次 `anchorX: 0.5→0.5`），仍会生成计划，但提交/协调因 operation schema 拒绝该记录；去掉未变化字段后操作通过。需为 CLI 计划器补“去除或拒绝无变化字段”的处理和回归测试。

## FILLED 径向填充与背景轨道验收补充（2026-10-25）

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15、扩展 0.8.104、CLI 0.12.60；场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。全程通过 Cocos CLI/MCP 与 CLI Preview 操作，没有桌面 UI 自动化。
- 临时轨道 SpriteFrame UUID `4929e852-f772-4afe-bf16-3a7073ee6f18`，填充 SpriteFrame UUID `845a4e39-2e7d-4c09-a222-bf5000419f21`；ProgressBar 节点 UUID `60b93f4f-8329-4619-83c5-365bbf50e9df`。填充 Sprite 为 `FILLED` (`type=3`)、`RADIAL` (`fillType=2`)，ProgressBar 为 `FILLED` (`mode=2`)，轨道为 SIMPLE annulus。
- 首轮截图中 25% 和 75% 的填充画面完全相同。CLI Inspector/磁盘读回发现填充 Sprite 的 `fillCenter=(0,0)`；圆形贴图落在以左下角为中心的 90° 扇区内，因此 25% 看起来仍是整圆。没有把错误画面记作通过。通过 CLI 将 `fillCenter` 改为 `(0.5,0.5)`，operation `0988b40c-4266-4a4a-998d-9aa85d8ab548`，保存读回确认 `_fillCenter`。随后进度 `0.75→0.25` operation `d1592405-a44e-49a6-b82c-ebcd1b6c7832`，Preview 断言 ProgressBar `progress=0.25`、Sprite `fillRange=0.25` 和无错误通过。`fillCenter` 不在 Preview 断言器的可读映射中，针对该字段的声明式断言返回 `null`；以 CLI Inspector/精确磁盘读回为准。截图 `/Users/youjunmao/.cocos-creator-agent/captures/318548a3-d4fe-4965-af24-7bf7d323ede5/capture-1792870317290-a7b768.png`，SHA-256 `5060c4a57fcf516095b42a351f9fefb8380b468413c25f9ee4c5d41a645f6efd`，显示四分之一填充和剩余轨道。
- 再将进度 `0.25→0.75`，operation `239a07d9-d373-4ee8-a434-6ee807951ce3`，用 CLI 停止预览、关闭并重开 Creator 工程。关闭前实例 `aaebfaec-cd74-4680-81bf-456daac74bd0` / PID 13217；重开实例 `9f45ae0b-f8db-4c3a-a787-fa2a66aa6617` / PID 14683。重启后重新启动 Preview，场景身份、ProgressBar `progress=0.75`、Sprite `fillRange=0.75` 和 `no-errors` 断言全部通过；截图 `/Users/youjunmao/.cocos-creator-agent/captures/fbc98976-7330-4621-9918-58aa3f145491/capture-1792870426341-163afc.png`，SHA-256 `49e51cbbc7441bc946359733bb21187f32121d7c8eaa15f9388408c730718603`，显示四分之三填充和剩余轨道。
- 按 CLI 操作清理夹具：来源补偿 `barSprite` 引用 operation `3e04d508-c126-4c57-a757-35e619d00b38`，补偿 operation `4f80de06-924f-413d-86b8-b95ea21428ef`，并恢复节点 `180×40`；ProgressBar `progress=0.5`、`mode=0` 分别通过 operation `a6ceba44-dc58-4763-bee2-fc2c624eebda`、`be1d4e4f-7ea5-4ad2-a4a3-20c6a07da495`。两个临时节点经精确 CLI 删除 operation `05567e63-7a21-44c5-86bd-8e5bdd406014`、`d87e2d85-9589-4264-a08c-6e00877fb669`。轨道与径向 PNG 分别经完整无引用扫描后由 AssetDB 删除，operation `71c7da5b-33ae-4293-9a4c-119428edcd34`、`9568b667-3f34-4634-bb53-e782983f8d8c`；其 `.meta` 和 SpriteFrame 子资源一并消失。
- 清理后再次由 CLI 关闭并重开工程：关闭 PID 14683，重开实例 `0c08c1cf-d1d5-4c7a-a185-37762def07f1` / PID 15204。最终快照为 23 节点；ProgressBar 恢复 `barSprite=null`、`mode=0`、`totalLength=1`、`progress=0.5`、`reverse=false`，节点尺寸 `180×40`。AssetDB 搜索不再返回临时轨道或填充资源；场景 `.fire` SHA-256 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，均回到基线。
- 本证据覆盖 Creator 2.4.15 Web Preview 的 FILLED/RADIAL 25% 与 75%、中心点设置和背景 annulus；不代表其他平台渲染验收。CLI Preview 断言器现通过已核实的 `_fillRange` 存储字段读取 `cc.Sprite.fillRange`，不调用组件 getter。

## FILLED 垂直填充验收补充（2026-10-25）

- 工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15、扩展 0.8.106、CLI 0.12.60；场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。全程使用 Cocos CLI/MCP 与 CLI Preview，没有使用桌面 UI 自动化。
- 临时贴图 `CliProgressBarVertical.png` 主资源 UUID `be4c9949-320e-483a-82a3-d20ff67208a8`，SpriteFrame UUID `6dcfd9c2-cf9f-4e60-8706-d4183981e471`；临时填充节点 UUID `392fe79e-a156-4bcf-9803-c264226dd636`，Sprite 组件 ID `cbXk+Jd2NOwI5KE1IX+VaS`。ProgressBar 节点 UUID `60b93f4f-8329-4619-83c5-365bbf50e9df`，组件 ID `9audFc1QZHOacPs9VtFhB1`。
- Sprite 设置为 `type=3 (FILLED)`、`fillType=1 (VERTICAL)`、`fillCenter=(0.5,0.5)`；ProgressBar 设置为 `mode=2 (FILLED)`、`totalLength=1`。Creator 在 mode/引用变更时会重算 `totalLength`，因此夹具在设置引用与模式后显式写入 1。进度 `0.25` 时 Preview 断言确认场景身份、ProgressBar progress、Sprite.fillRange 及无新增运行时错误；截图 SHA-256 `049d94d112009140abad44f41fb297c8ff401935e957cb1b428e3fc296ae2427` 显示满宽约四分之一高度的填充。进度 `0.75` 时同类断言通过，截图 SHA-256 `6223f500abcf9645fa2cd26860f5b8366d79f1e35e1c37362b9a189e9f588122` 显示约四分之三高度的填充。
- `totalLength=1` 是修正 Preview 首轮未显示填充的关键：mode setter 读取 Sprite 初始 `fillRange=0` 并把总长度设为 0。显式恢复非零总长度后，Sprite `fillRange` 与 ProgressBar `progress` 同步为 0.25/0.75，视觉结果符合垂直填充预期。
- 75% 状态保存后通过 CLI 关闭并重开同一工程，Creator 2.4.15 / 扩展 0.8.106 握手成功；新实例 `9883e234-eba5-4e54-957d-c07162504c51` 的 Preview 再次通过场景、ProgressBar progress=0.75、Sprite.fillRange=0.75 和无错误断言。重开后截图 SHA-256 `15e41d5b138255bb17dfc788958726e79f80bea4141c98547135550bf1ac2bfc`。
- 清理由 CLI 对每次变更做来源补偿，并显式恢复 Creator setter 派生的 `totalLength`。临时节点通过删除 operation `7b994ea9-96da-4705-945b-4bae83f5d800` 移除，磁盘读回确认节点 UUID 不存在且场景 SHA-256 回到 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`。完整 AssetDB 引用扫描覆盖 10 个文本文件、0 条引用；临时贴图及其 SpriteFrame 子资源通过 AssetDB 删除 operation `8cbc7ff5-cad3-46f3-9227-d4e4d3c6127c` 清理。`.meta` SHA-256 始终为基线 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
- 最终再次由 CLI 关闭并重开工程，实例 `670a666e-a0c4-44aa-bf6e-70592896ad83` 返回精确工程路径、Creator 2.4.15、扩展 0.8.106；CLI doctor 8 项检查全部通过。重开场景快照为 23 个节点，临时 AssetDB 搜索返回 0 项，场景与 `.meta` SHA-256 均与基线一致。该证据覆盖 Web Preview 的 FILLED/VERTICAL 25% 与 75%；反向 FILLED/RADIAL、不同 SpriteFrame 和其他目标平台仍待验收。
