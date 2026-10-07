---
name: cocos3-scene-composition
description: Plan and execute a recoverable ordered empty-node hierarchy in Cocos Creator 3.8.7.
---

# Creator 3.8 scene composition

Use this skill for an authorized multi-node edit in a Creator 3.8.7 `.scene` file. Read the [3.8 scene editing manual](https://docs.cocos.com/creator/3.8/manual/zh/concepts/scene/scene-editing.html) and [composition contract](../../scene-composition-0.1.md).

1. Select the exact 3.8 project and active scene. Read external parent paths and UUIDs with `scene.node.inspect`.
2. Call `workflow.plan` with 2–8 ordered empty-node steps. Use `{ "ref": "step-id" }` only for an earlier created parent. Check `outcome=ready`.
3. Call `workflow.execute` with the same plan and preserve `workflowId`. Check each step's `operationId`, `status`, and the final `outcome`.
4. If `outcome=needs-review`, use `workflow.get` and each operation's `operation.get` to inspect the persisted result. Do not blindly retry or start a second plan.
5. For reversal, call `workflow.compensate`; it removes owned nodes from child to parent. Replay only after full compensation.

Keep 3.8 `.scene` and component semantics separate from Creator 2.4. An empty node has no visual preview evidence; use saved scene readback and hierarchy inspection. A Creator restart changes the instance identity and blocks unfinished automatic continuation.
