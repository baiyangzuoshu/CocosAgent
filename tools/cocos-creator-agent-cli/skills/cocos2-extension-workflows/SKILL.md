---
name: cocos2-extension-workflows
description: Routes Creator 2.4.x editor extension, JSB native plugin, and project-level Agent extension work.
---

# 扩展工作流路由

## Use when

Develop a Creator 2.4.x editor extension, JSB native plugin, or project-local Agent extension.

## Route

Editor extension → `cocos2-creator-extension-development`; JSB/platform native code → `cocos2-jsb-native-plugins`; project Skills/declared command aliases → `cocos2-project-extensions`.

## Routing rules

- For a conceptual question, answer directly without activating an edit workflow.
- Read the selected specialist Skill before task-specific Creator tools; load only references needed for its contract.
- If multiple domains are needed, order their read/modify/verify steps and keep each write target explicit. Do not imply that one Skill’s acceptance covers another domain.
- If a task requires changing Creator-owned scene, Prefab, importer, or runtime state and the matching Creator-aware operation is absent, stop that part, report the exact gap, and provide manual Creator steps. Continue ordinary source-file work only when the Host tools and approved task scope support it.
- Route by the user’s actual task and current project evidence, not by a remembered project name or assumed framework.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
