---
name: cocos2-build-delivery-workflows
description: Routes Creator 2.4.x Web/mobile builds, content releases, Asset Bundles, and output optimization.
---

# 构建与交付工作流路由

## Use when

Build a Web/mobile target, stage content, publish an Asset Bundle release, or optimize output for Creator 2.4.x.

## Route

Web/mobile build receipt → `cocos2-content-build`; content/Bundle release → `cocos2-asset-bundle-content`; size/startup/platform budget → `cocos2-web-mobile-optimization`.

## Routing rules

- For a conceptual question, answer directly without activating an edit workflow.
- Read the selected specialist Skill before task-specific Creator tools; load only references needed for its contract.
- If multiple domains are needed, order their read/modify/verify steps and keep each write target explicit. Do not imply that one Skill’s acceptance covers another domain.
- If the selected specialist’s required command is missing or unavailable in the live Creator capability catalog, report the precise gap and stop before writing.
- Route by the user’s actual task and current project evidence, not by a remembered project name or assumed framework.

## Creator 2.4.x version evidence

Use the bundled `../../references/2x/` notes only when the task needs engine API or serialized-data details. Those notes document Creator 2.4.15 behavior; verify the exact patch and target platform, and do not generalize them to every 2.4.x release.
