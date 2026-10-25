# Targeted behavior comparison for eight Cocos Skills

Baseline Skill source: `c5d1006bafd6c90c066d81f8bf7dfb02fd61c6f4`.
Model: `gpt-6.1-sol`, reasoning effort: `medium`; Codex CLI: `codex-cli 0.163.0-alpha.10.2`.
Task set: 8 Skills, 16 cases (one positive and one near-miss per Skill).

Behavior score: **14/16 (88%) → 16/16 (100%)**.

| Skill | Before | After |
| --- | ---: | ---: |
| cocos2-cli | 2/2 | 2/2 |
| cocos2-prefab-source-edit | 2/2 | 2/2 |
| cocos2-mcp-tools | 2/2 | 2/2 |
| cocos2-runtime-observation | 2/2 | 2/2 |
| cocos2-scene-composition | 1/2 | 2/2 |
| cocos2-scene-node-operations | 1/2 | 2/2 |
| cocos2-script-development | 2/2 | 2/2 |
| cocos2-task-review-recovery | 2/2 | 2/2 |

## Behavior changes

- **scene-compose-existing-node-rename-nearmiss** now passes. The revised Skill explicitly routes the adjacent request to its sibling workflow.
- **scene-node-new-hierarchy-nearmiss** now passes. The revised Skill explicitly routes the adjacent request to its sibling workflow.
- No baseline-passing case regressed.

## Static analysis

| Skill | Before | After |
| --- | ---: | ---: |
| cocos2-cli | D/67 | B/86 |
| cocos2-prefab-source-edit | D/67 | C/81 |
| cocos2-mcp-tools | C/81 | B/86 |
| cocos2-runtime-observation | C/81 | C/81 |
| cocos2-scene-composition | C/81 | C/81 |
| cocos2-scene-node-operations | C/81 | C/72 |
| cocos2-script-development | C/81 | C/81 |
| cocos2-task-review-recovery | C/77 | C/72 |

The weak-trigger-description finding cleared for all eight Skills. Token-budget findings remain on several Skills; these are static estimates, not behavior failures.

## Method and limits

- The before phase loaded each Skill from the pinned source commit; the after phase loaded the current working-tree Skill. Each Codex run used an isolated workspace and isolated home with no MCP servers or Creator editor connection.
- Each case required a structured `evaluation.json`; `grade-phase.mjs` applied the finalized deterministic verifier to the captured outputs. During the initial runs, some equivalent status/operation wording was rejected by the first verifier draft; the outputs were regraded with the final acceptance rules without rerunning Codex.
- One Codex run per Skill evaluated both cases. Results are a targeted regression signal, not a statistical estimate. The benchmark does not validate live Creator editor, scene persistence, or runtime behavior, and it has no no-Skill control.
- Raw run artifacts and per-phase graded results are under `/private/tmp/cocos-skill-benchmark/`; the task prompts and verifier are versioned beside this report.
