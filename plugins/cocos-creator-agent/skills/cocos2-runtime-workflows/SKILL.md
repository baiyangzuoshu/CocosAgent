---
name: cocos2-runtime-workflows
description: Routes Creator 2.4.x Web preview behavior, runtime assertions, performance, and native memory tasks.
---

# 运行时工作流路由

## Use when

Verify a Creator 2.4.x preview, diagnose behavior, measure performance, or inspect JSB memory.

## Route

Console/screenshot/interaction → `cocos2-runtime-observation`; explicit performance budget → `cocos2-runtime-performance`; dynamic loads/cache/refcounts → `cocos2-dynamic-content-performance`; JSB native memory → `cocos2-native-memory-bridge`.

## Routing rules

- For a conceptual question, answer directly without activating an edit workflow.
- Read the selected specialist Skill before task-specific Creator tools; load only references needed for its contract.
- If multiple domains are needed, order their read/modify/verify steps and keep each write target explicit. Do not imply that one Skill’s acceptance covers another domain.
- If the selected specialist’s required command is missing or unavailable in the live Creator capability catalog, report the precise gap and stop before writing.
- Route by the user’s actual task and current project evidence, not by a remembered project name or assumed framework.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
