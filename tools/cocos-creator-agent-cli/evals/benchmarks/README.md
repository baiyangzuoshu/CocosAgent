# Targeted Skill behavior benchmark

This suite covers the two D-grade and six C-grade Skills from the 2026-10-22 static baseline. Each Skill has one on-topic task and one near-miss/boundary task. Prompts use an offline fixture and require a structured `evaluation.json`; the verifier checks routing, evidence, safe boundaries, and that no live mutation is claimed.

Run against the original Skill snapshot and the current Skill files:

```sh
node tools/cocos-creator-agent-cli/evals/benchmarks/run-suite.mjs --phase baseline
node tools/cocos-creator-agent-cli/evals/benchmarks/grade-phase.mjs --phase baseline
node tools/cocos-creator-agent-cli/evals/benchmarks/run-suite.mjs --phase after
node tools/cocos-creator-agent-cli/evals/benchmarks/grade-phase.mjs --phase after
node tools/cocos-creator-agent-cli/evals/benchmarks/compare-phases.mjs
```

The baseline is pinned to the Skill content from commit `c5d1006bafd6c90c066d81f8bf7dfb02fd61c6f4`; the `after` phase copies the working tree. Results and Codex traces are written under `/private/tmp/cocos-skill-benchmark/` by default. The runner uses `gpt-6.1-sol` at medium reasoning for both phases, gives each run an isolated Codex home with no MCP servers, and copies only the authentication file needed for Codex execution. It removes that temporary auth source when the phase ends.

The verifier's pass is a deterministic task-contract check, not a judgment of prose quality. Review each preserved `evaluation.json` and final message against the `successChecklist` in `suite.json`. This benchmark checks skill-guided task behavior in an offline Codex workspace; it does not test Creator editor integration, scene persistence, or runtime behavior.

The checked-in [behavior comparison](behavior-comparison-2026-10-22.md) records the baseline and after results. `compare-phases.mjs` reads the preserved phase outputs plus the static plugin-eval snapshots from `/private/tmp`; those raw files are local evaluation artifacts and are not checked in.
