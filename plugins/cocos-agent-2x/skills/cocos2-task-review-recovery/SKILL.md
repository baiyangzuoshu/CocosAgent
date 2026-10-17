---
name: cocos2-task-review-recovery
description: Review run-scoped CocosAgent code, scene, Prefab and resource receipts, and resolve interrupted Creator writes without overwriting later changes.
---

# Task review and recovery

Use the recent run review as a summary of recorded Creator receipts only. Separate code, scene/Prefab and other writes; preserve operation IDs and each command's own before/after evidence. Do not call the receipt summary a full project or Git diff. State which disk, editor, compile and runtime reads remain missing.

Cancellation stops future scheduling. It does not reverse a tool already dispatched. Wait for and record its receipt. After a Host/Creator restart, a write run marked `needs-review` stays locked until the exact original operation is read back. Never replay or create a replacement write to resolve uncertainty.

If current Creator/disk values exactly match the recorded after-state, use only the matching operation's documented compensation path after approval. If they match the before-state, record no-effect/already-restored. If they match neither state, or target identity changed, report a conflict and stop. Do not overwrite the current value.

Task-scoped permission and filesystem checkpoint restore are design-only in this version. Do not claim they are available, do not create a broad project snapshot, and do not use Git reset/stash/checkout as a recovery shortcut. See `cocos-agent-task-review-recovery-0.1.md`.
