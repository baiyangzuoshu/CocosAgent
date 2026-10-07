# PNG 放入场景 skill 验收状态

两份操作型 skill 分别为 [`cocos2-png-to-scene`](cocos2-png-to-scene/SKILL.md) 和 [`cocos3-png-to-scene`](cocos3-png-to-scene/SKILL.md)。它们复用 `scene.pngSprite` 语义及 Host 合同，但场景前置条件和编辑器实现各自独立。

| 验收点 | 2.4.15 | 3.8.7 |
| --- | --- | --- |
| skill 结构校验 | `quick_validate.py` 通过 | `quick_validate.py` 通过 |
| 命令目录与项目版本精确选择 | 旧目录有实机记录；新版动态目录通过扩展源码合同与模拟 Host 测试，实机待测 | 旧目录有实机记录；新版动态目录通过扩展源码合同与模拟 Host 测试，实机待测 |
| PNG 导入、Sprite 放置、磁盘与 Web 预览、补偿 | 旧会话合同的示例闭环已实测 | 旧会话合同的示例闭环已实测 |
| 独立 operationId、编辑器写入后中断、`operation.get` 恢复 | 本机模拟扩展完整协议通过；真实 Creator 待测 | 本机模拟扩展验证了通用 Host；真实 Creator 首轮被旧扩展预检拒绝，未写场景 |

下一轮真实试跑先重载两版扩展并复查 `capabilities.list` 的 `instanceId`、`catalogRevision`、`inputSchema` 和前置条件。再分别在 `helloworld.fire`、`main.scene` 中用已导入的 `cocos-agent-smoke.png` 执行 `apply --interrupt-after-editor`、新进程 `operation.get`、独立 `compensate`，记录场景文件和预览结果。确认补偿后两版示例场景没有 Agent 节点。2.4 的 Package Manager Reload 曾卸载扩展，应完整重开工程验证；3.8 用扩展管理器重载。Mac 当前锁屏，尚无法完成该轮编辑器验收。

证据基线：[旧闭环轨迹](../traces/cocos-agent-scene-write-web-0.1.jsonl)、[目录轨迹](../traces/cocos-agent-catalog-0.1.jsonl)、[持久操作轨迹](../traces/cocos-agent-operation-persistence-0.1.jsonl)。已有轨迹只证明各自标明的合同版本和环境，不自动覆盖新版技能执行。
