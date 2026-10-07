# 只读实例与命令目录验收

本轮目标：Agent 先查实例，再以项目绝对路径和 Creator 版本选中目标，最后依据 `capabilities.list` 的合同和 `status/reason` 判断命令是否可用。整个查询链只调用 `capabilities.list` 与 `scene.snapshot`，不发送导入或场景写入命令；场景文件验收前后应逐字节一致。跨重启操作记录和恢复留到下一轮。

1. 两版示例同时打开并重载当前 `cocos-agent-bridge` 扩展。分别记录 `helloworld.fire`、`main.scene` 的 SHA-256。运行 `catalog-host.js`，用两个 `--target` 和 `--query instances.list`，要求返回两个 `ready` 实例、不同 `instanceId`，项目路径和版本分别精确匹配。
2. 对两项目分别运行 `--query instances.get --project <绝对路径> --creator-version <本版>`；版本错误必须返回 `CREATOR_VERSION_MISMATCH`，无目标返回 `EDITOR_NOT_FOUND`，同项目重复配置返回 `AMBIGUOUS_EDITOR`。不得选最近使用窗口代替明确目标。
3. 对选中的目标运行 `--query capabilities.list`。三条命令分别是 `scene.snapshot`、`asset.importPng`、`scene.pngSprite`；每条均包含 `contractVersion`、`access`、内联 `input` JSON Schema、`inputSchema`、`preconditions`、`status` 和 `reason`。只有 `scene.pngSprite.status=available` 且输入合同匹配时，Agent 才能判断该命令在当前场景可用；本轮不执行它。
4. 2.4 在 `helloworld.fire` 与 `stage4-empty.fire` 间切换，3.8 在 `main.scene` 与 `stage4-empty.scene` 间切换。每次重新查询目录，核对 `activeScene` 与 `catalogRevision` 随场景变化；切回原场景。2.4 的 `stage4-empty.fire` 实际仍含 Canvas，因此 `scene.pngSprite` 在该场景保持 `available`。无 Canvas 的 `CANVAS_NOT_FOUND` 分支只经模拟合同测试，未纳入本轮实机场景切换验收。
5. 分别重载扩展并重新查询。`instanceId` 应改变；在同一场景和同一能力集下，`catalogRevision` 可以保持不变。再次核对场景文件 SHA-256 未变，记录 Creator 控制台错误与 Host 回执。

已通过的自动化证据：`tools/cocos-agent-bridge/catalog-host.mock-test.js` 覆盖多实例、精确选择、歧义/版本错误、场景变化、扩展实例变化、目录输入/状态校验，且模拟场景文件 SHA-256 不变；`catalog-extension-contract.test.js` 直接核对两版扩展的目录构造结果。真实 Creator 已返回两个 `ready` 实例，精确选中两版项目并返回完整能力目录；错误版本请求返回 `CREATOR_VERSION_MISMATCH`。两版切换至 `stage4-empty` 后 `activeScene` 与 `catalogRevision` 都变化，切回原场景后修订值恢复；两版扩展重载后 `instanceId` 均改变，原场景的修订值保持不变。四个场景文件最终 SHA-256 与起点逐一相同。本轮只读完成标准已达到，见 [实机轨迹](traces/cocos-agent-catalog-live-0.2.jsonl)。
