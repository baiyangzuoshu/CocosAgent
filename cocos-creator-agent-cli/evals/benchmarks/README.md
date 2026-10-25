# Targeted Skill behavior benchmark

This suite covers the two D-grade and six C-grade Skills from the 2026-10-22 static baseline. Each Skill has one on-topic task and one near-miss/boundary task. Prompts use an offline fixture and require a structured `evaluation.json`; the verifier checks routing, evidence, safe boundaries, and that no live mutation is claimed.

Run against the original Skill snapshot and the current Skill files:

```sh
node cocos-creator-agent-cli/evals/benchmarks/run-suite.mjs --phase baseline
node cocos-creator-agent-cli/evals/benchmarks/grade-phase.mjs --phase baseline
node cocos-creator-agent-cli/evals/benchmarks/run-suite.mjs --phase after
node cocos-creator-agent-cli/evals/benchmarks/grade-phase.mjs --phase after
node cocos-creator-agent-cli/evals/benchmarks/compare-phases.mjs
```

To test whether the same cases can be solved without a Cocos Skill, run a matched control phase:

```sh
node cocos-creator-agent-cli/evals/benchmarks/run-suite.mjs --phase control --output-dir /private/tmp/cocos-skill-benchmark-control
node cocos-creator-agent-cli/evals/benchmarks/grade-phase.mjs --phase control --output-dir /private/tmp/cocos-skill-benchmark-control
node cocos-creator-agent-cli/evals/benchmarks/compare-control.mjs --control-results-root /private/tmp/cocos-skill-benchmark-control
```

Add `--resume` to continue a partially completed phase; captured, valid `evaluation.json` outputs are retained.

The baseline is pinned to the Skill content from commit `c5d1006bafd6c90c066d81f8bf7dfb02fd61c6f4`; the `after` phase copies the working tree. Results and Codex traces are written under `/private/tmp/cocos-skill-benchmark/` by default. The runner uses `gpt-6.1-sol` at medium reasoning for both phases, gives each run an isolated Codex home with no MCP servers, and copies only the authentication file needed for Codex execution. It removes that temporary auth source when the phase ends.

The verifier's pass is a deterministic task-contract check, not a judgment of prose quality. Review each preserved `evaluation.json` and final message against the `successChecklist` in `suite.json`. The control phase installs only an unrelated aquarium-fish identification Skill, so it measures behavior without any Cocos target Skill while keeping Plugin Eval's isolated-skill setup unchanged. This benchmark checks offline Codex behavior; it does not test Creator editor integration, scene persistence, or runtime behavior.

The checked-in 2026-10-22 behavior report records the earlier task-set revision. Commit `e998796` changed the Prefab-commit contract and the scene-node commit case; rerun both `baseline` and `after` against the current `suite.json` before comparing current results. The grader and comparison script reject mismatched case IDs so old outputs cannot silently produce a new score.

The checked-in [behavior comparison](behavior-comparison-2026-10-22.md) records the baseline and after results. `compare-phases.mjs` reads the preserved phase outputs plus the static plugin-eval snapshots from `/private/tmp`; those raw files are local evaluation artifacts and are not checked in.
