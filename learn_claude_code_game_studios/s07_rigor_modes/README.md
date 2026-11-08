# 第 7 课：Rigor 与工作流档位

**目标：** 理解 `modes.rigor` 如何统一调节设计文档、QA、Story 粒度和评审流程。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/docs/workflow-modes.md`：工作流档位解释。
- `.claude/docs/effects-map.md`：只读 `modes.rigor` 及其相关设置章节。
- `.claude/docs/workflow-catalog.yaml`：minimal 路径与阶段阶梯。
- `README.md` 的 Configuration 与 Default Path 部分。

## 观察步骤

1. 对照 `minimal`、`standard`、`full` 的文档和 QA 要求。
2. 找出 rigor 前置（fronts）的六个细项。
3. 比较 minimal 路径与 standard/full 阶段 Gate 路径。
4. 分辨团队级共享设置与个人可覆盖的设置。

## 观察结果

Rigor 管理工作流的重量。minimal 默认路线用一页 brief、Story 和逐个实现快速进入代码；standard/full 增加设计覆盖、评审与证据。单项显式设置仍能覆盖相应派生值。

## 实践

只在隔离副本中运行 `/settings modes.rigor=standard`，然后执行：

~~~sh
bash .claude/hooks/yaml-helper.sh resolve_config --keys modes.rigor,modes.workflow,docs.density,qa.level,modes.review_mode,team.size
~~~

把结果保存下来，再用 `/settings modes.rigor=minimal` 重复一次。比较两组派生值，并确认实际项目的配置文件没有被改动。

## 简化说明

不同 Skill 对 rigor 的响应细节分散在自己的实现和 effects map 中。本课只比较主路径，不替代某个 Skill 的逐项检查。

## 自测

判断“把 `modes.automation` 改为 autonomous”会不会把项目从 minimal 变成 full，并用各自负责的决策维度说明理由。
