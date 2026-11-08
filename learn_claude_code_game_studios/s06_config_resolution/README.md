# 第 6 课：项目配置解析

**目标：** 从多个配置来源推导 Skill 实际看到的设置，并理解配置输出中的来源标记。

## 源码位置

- `engine/Claude-Code-Game-Studios/project.yaml`：团队共享配置和框架版本。
- `.claude/docs/config-resolution.md`：优先级、默认值与解析规则。
- `.claude/hooks/yaml-helper.sh`：配置读取入口。
- `.gitignore`：本地覆盖文件的忽略规则。

## 观察步骤

1. 从配置文档记录优先级：`project.local.yaml`、`project.yaml`、兼容旧文件、rigor 派生值、默认值。
2. 追踪一个设置（例如 `modes.automation`）在各层缺省时落到哪里。
3. 检查配置解析如何报告非法值和 provenance（来源）。
4. 核对当前模板的 `project.yaml`：它记录框架版本，但没有项目初始化后的配置块。

## 观察结果

有效配置不是简单读取一个 YAML 文件；它还考虑个人覆盖、兼容旧值、rigor 派生规则和终端默认值。解析结果带来源信息，便于定位为何得到某个值。

## 简化说明

这里只按文档和 helper 的静态规则演算，不创建 `project.local.yaml`，也不修改共享配置。大型 `effects-map.md` 应按设置名读取对应章节，不要整文件读取。

## 自测

用表格列出一个设置的每层候选值、最终胜出的值和来源，并说明个人覆盖为何不应提交到团队配置。
