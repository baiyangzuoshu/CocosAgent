# Targeted Skill behavior benchmark

This suite covers all 52 Skills (the global `cocos-agent` entry plus 51 Creator Skills). Each has one representative request and one near-miss/boundary request, for 104 offline cases. Prompts require structured `evaluation.json`; the verifier checks routing, scope, evidence, and that no live mutation or result is claimed.

Acceptance thresholds and result categories are defined in [acceptance-protocol.md](acceptance-protocol.md).

## Phases

- `after`: all 52 current Skills, 104 cases.
- `baseline`: the 13 Skills whose content changed since commit `c5d1006bafd6c90c066d81f8bf7dfb02fd61c6f4`, 26 matched cases. The runner supports both the historical `tools/cocos-creator-agent-cli/skills` path and the current package path.
- `control`: the 13 changed Skills plus the five current C-grade Skills, deduplicated to 15 Skills and 30 cases. The isolated Codex home contains only an unrelated sentinel Skill.
- `Creator 2.4.15`: a separate live-editor acceptance list of 19 Skills is recorded in `suite.json`. Each live operation must use an identity-checked isolated project and verify the actual readback; offline benchmark results do not count as editor evidence.

The suite has no direct Skill activation telemetry. Route choice and task behavior are evidence proxies. If a target Skill and the no-target control achieve the same result, treat that case as nondiscriminating and revise it before claiming Skill-specific benefit.

Run the historical baseline and current Skill files with the same model, reasoning effort, and Codex CLI version:

```sh
node cocos-creator-agent-cli/evals/benchmarks/run-suite.mjs --phase baseline
node cocos-creator-agent-cli/evals/benchmarks/grade-phase.mjs --phase baseline
node cocos-creator-agent-cli/evals/benchmarks/run-suite.mjs --phase after
node cocos-creator-agent-cli/evals/benchmarks/grade-phase.mjs --phase after
node cocos-creator-agent-cli/evals/benchmarks/compare-phases.mjs
```

To test whether the deep cases can be solved without a Cocos Skill, run a matched control phase:

```sh
node cocos-creator-agent-cli/evals/benchmarks/run-suite.mjs --phase control --output-dir /private/tmp/cocos-skill-benchmark-control
node cocos-creator-agent-cli/evals/benchmarks/grade-phase.mjs --phase control --output-dir /private/tmp/cocos-skill-benchmark-control
node cocos-creator-agent-cli/evals/benchmarks/compare-control.mjs --control-results-root /private/tmp/cocos-skill-benchmark-control
```

Add `--resume` to continue a partially completed phase; captured, valid `evaluation.json` outputs are retained.

The baseline is pinned to the Skill content from commit `c5d1006bafd6c90c066d81f8bf7dfb02fd61c6f4`; the `after` phase copies the working tree. Results and Codex traces are written under `/private/tmp/cocos-skill-benchmark/` by default. The runner uses `gpt-6.1-sol` at medium reasoning, records the Codex CLI version, gives each run an isolated Codex home with no MCP servers, and copies only the authentication file needed for Codex execution. It removes that temporary auth source when the phase ends. Service timeouts and Plugin Eval setup failures are recorded as infrastructure errors; they are excluded from behavior pass/fail and can be retried with `--resume`.

The verifier's pass is a deterministic task-contract check, not a judgment of prose quality. Review each preserved `evaluation.json` and final message against the `successChecklist` in `suite.json`. The control phase installs only an unrelated aquarium-fish identification Skill, so it measures behavior without any Cocos target Skill while keeping Plugin Eval's isolated-skill setup unchanged. This benchmark checks offline Codex behavior; it does not test Creator editor integration, scene persistence, or runtime behavior.

The historical [2026-10-22 report](behavior-comparison-2026-10-22.md) covers only the earlier eight-Skill task-set revision. Current comparison output is `behavior-comparison-2026-10-25.md`; the grader and comparison scripts reject task-set fingerprint mismatches so old outputs cannot silently produce a new score.

The historical 2026-10-22 report is retained as a record of the earlier eight-Skill task set. It is not a result for the expanded 52-Skill matrix.
