---
name: cocos2-project-workflows
description: Routes Creator 2.4.x project setup, dependency, search, and project-wide code tasks to the matching specialist skill.
---

# 项目、依赖与代码工作流路由

## Use when

Project setup, package/dependency changes, project-wide search, or multi-file implementation in a Creator 2.4.x project.

## Route

Initialize a new project → `cocos2-project-bootstrap`; inspect/manage packages → `cocos2-package-management`; search scripts/assets/scenes/Prefabs/references → `cocos2-project-search`; cross-file feature → `cocos2-project-development`; project Agent extension → `cocos2-project-extensions`.

## Routing rules

- For a conceptual question, answer directly without activating an edit workflow.
- Read the selected specialist Skill before task-specific Creator tools; load only references needed for its contract.
- If multiple domains are needed, order their read/modify/verify steps and keep each write target explicit. Do not imply that one Skill’s acceptance covers another domain.
- If a task requires changing Creator-owned scene, Prefab, importer, or runtime state and the matching Creator-aware operation is absent, stop that part, report the exact gap, and provide manual Creator steps. Continue ordinary source-file work only when the Host tools and approved task scope support it.
- Route by the user’s actual task and current project evidence, not by a remembered project name or assumed framework.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
