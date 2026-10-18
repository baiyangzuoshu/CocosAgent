---
name: cocos2-resource-workflows
description: Routes Creator 2.4.x resource import and content-authoring requests to asset-specific skills.
---

# 资源工作流路由

## Use when

Import or configure Creator 2.4.x resources, text, animation, or TileMap content.

## Route

Import/AssetDB/scene placement → `cocos2-resource-scene-pipeline`; texture settings → `cocos2-texture-import-settings`; atlas packing → `cocos2-sprite-atlas`; font/Label → `cocos2-fonts-text`; locale data → `cocos2-localization`; clips → `cocos2-animation`; Tiled content → `cocos2-tilemap`.

## Routing rules

- For a conceptual question, answer directly without activating an edit workflow.
- Read the selected specialist Skill before task-specific Creator tools; load only references needed for its contract.
- If multiple domains are needed, order their read/modify/verify steps and keep each write target explicit. Do not imply that one Skill’s acceptance covers another domain.
- If the selected specialist’s required command is missing or unavailable in the live Creator capability catalog, report the precise gap and stop before writing.
- Route by the user’s actual task and current project evidence, not by a remembered project name or assumed framework.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
