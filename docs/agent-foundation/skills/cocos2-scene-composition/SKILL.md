---
name: cocos2-scene-composition
description: Plan and execute a recoverable ordered Cocos Creator 2.4.15 node hierarchy with optional Sprite or Label children and 2D transforms.
---

# Creator 2.4 scene composition

Use this skill for an authorized multi-node edit in a Creator 2.4.15 `.fire` scene. Read the [2.4 node tree manual](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/node-tree.html) and [composition contract](../../scene-composition-0.1.md).

1. Select the exact 2.4 project and active scene. Read external parent paths and UUIDs with `scene.node.inspect`.
2. Call `workflow.plan` with 2–8 ordered steps. Use `{ "ref": "step-id" }` only for an earlier created parent. A step may contain one `cc.Sprite` with an imported SpriteFrame UUID or one `cc.Label` with text, plus 2D `position`/`scale`. Put Sprite and Label on separate sibling nodes. Check `outcome=ready`.
3. Call `workflow.execute` with the same plan and preserve `workflowId`. Check each step's `operationId`, `status`, and the final `outcome`.
4. If `outcome=needs-review`, use `workflow.get` and each operation's `operation.get` to inspect the persisted result. For an eligible failed node operation, use `operation.reconcile` only after confirming the recorded scene is open; it requires both active-scene and disk readback. Do not blindly retry or start a second plan.
5. For reversal, call `workflow.compensate`; it removes owned nodes from child to parent. Replay only after full compensation.

Keep 2.4 `.fire` and `cc` semantics separate from Creator 3.8. Component-bearing steps require the operation's automatic runtime structural preview receipt; it is not pixel comparison. A Creator restart changes the instance identity and blocks unfinished automatic continuation. Creator 3.8 composition remains empty-node-only; use its version-specific skill.
