---
name: cocos2-project-development
description: Search a Creator 2.4.15 project for relevant JavaScript, TypeScript, or asset files, then use existing Creator read/patch tools for a narrowly scoped existing JS/TS single-file change. Use when a task needs project code/resource discovery; new scripts, multi-file edits, generic component properties, and scene event binding are not yet available.
---

# Creator 2.4.15 project discovery and existing-script change

1. Select a ready Creator 2.4.15 instance and read its live capability catalog. For project-specific work, read the current project `AGENTS.md` when available and keep the sampled hash for the run.
2. Call `cocos_2x_project_search` with a narrow query and `scope=code`, `assets`, or `all`. Treat paths, line snippets, UUIDs, and hashes as discovery evidence; re-read the chosen file or query the scene/resource through its dedicated Creator tool before planning a change. Search is bounded to the project `assets/` tree and may return `truncated=true`.
3. For an existing `.js` or `.ts` component, follow `cocos2-script-development`: read exact source/UUID/meta hashes, propose unique replacements, obtain the write approval, apply with the original operation ID, and inspect Creator compile/readback receipts. The TS branch skips Node syntax parsing and requires exact Creator compiler evidence; if that evidence is unavailable, stop without claiming success. A compile result does not establish runtime behavior.
4. If the task requires creating a file, editing several files, changing arbitrary component fields, changing scene resource references outside the supported patch fields, or binding serialized events, stop before writing and report that the corresponding M1 command is not available. Do not imitate these operations with arbitrary shell access or hand-edited `.fire`/`.prefab` JSON.

## Recovery

For an existing JS/TS patch, preserve the exact `script.patch` operation ID. On uncertainty, read its operation record and reconcile the original operation; compensate only if the live source still matches its candidate hash. Never retry an uncertain apply or overwrite a later developer edit. Search is read-only and needs no compensation.
