---
name: cocos2-ui-workflows
description: Routes Cocos Creator 2.4.x UI requests across hierarchy, Widget layout, component fields, event binding, and script wiring.
---

# UI 工作流路由

## Use when

Build or modify Creator 2.4.x UI hierarchy, layout, properties, event bindings, or script connections.

## Route

Hierarchy/Canvas/Prefab → `cocos2-ui-structure`; responsive anchors/Widget → `cocos2-ui-layout`; component values → `cocos2-ui-component-properties`; event callbacks → `cocos2-ui-event-binding`; connect UI to behavior → `cocos2-ui-script-wiring`.

## Routing rules

- For a conceptual question, answer directly without activating an edit workflow.
- Read the selected specialist Skill before task-specific Creator tools; load only references needed for its contract.
- If multiple domains are needed, order their read/modify/verify steps and keep each write target explicit. Do not imply that one Skill’s acceptance covers another domain.
- If a task requires changing Creator-owned scene, Prefab, importer, or runtime state and the matching Creator-aware operation is absent, stop that part, report the exact gap, and provide manual Creator steps. Continue ordinary source-file work only when the Host tools and approved task scope support it.
- Route by the user’s actual task and current project evidence, not by a remembered project name or assumed framework.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
