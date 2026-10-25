---
name: cocos2-gameplay-workflows
description: Routes Creator 2.4.x gameplay systems to physics, navigation, animation, and script workflows.
---

# 玩法系统工作流路由

## Use when

Configure or diagnose physics, collision, navigation, or gameplay logic in Creator 2.4.x.

## Route

2D backend/body/contact → `cocos2-physics-2d`; 3D only if this exact build supports it → `cocos2-physics-3d`; pathfinding → `cocos2-navigation`; component logic → `cocos2-script-development`; animation asset/task → `cocos2-animation`.

## Routing rules

- For a conceptual question, answer directly without activating an edit workflow.
- Read the selected specialist Skill before task-specific Creator tools; load only references needed for its contract.
- If multiple domains are needed, order their read/modify/verify steps and keep each write target explicit. Do not imply that one Skill’s acceptance covers another domain.
- If a task requires changing Creator-owned scene, Prefab, importer, or runtime state and the matching Creator-aware operation is absent, stop that part, report the exact gap, and provide manual Creator steps. Continue ordinary source-file work only when the Host tools and approved task scope support it.
- Route by the user’s actual task and current project evidence, not by a remembered project name or assumed framework.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
