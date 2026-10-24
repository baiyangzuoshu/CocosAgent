# Skill evaluation

Use OpenAI's `plugin-eval` for static Skill analysis and curated, isolated Codex benchmarks. The Cocos CLI does not depend on this developer tool, and the evaluator is not shipped in the CLI tarball.

Install the OpenAI Codex plugin once with `codex plugin add plugin-eval@openai-curated`. The repository wrapper finds the installed plugin in `CODEX_HOME` by default, or accepts an explicit script path.

Run a static scan across the complete CLI Skills directory:

```sh
node tools/cocos-creator-agent-cli/evals/analyze-skills.mjs --format markdown
node tools/cocos-creator-agent-cli/evals/analyze-skills.mjs --format json --output /tmp/cocos-skills-eval.json
node tools/cocos-creator-agent-cli/evals/analyze-skills.mjs --skill cocos2-scene-composition
```

The current 52-Skill snapshot is recorded in [skill-static-analysis-2026-10-23.md](skill-static-analysis-2026-10-23.md).

The static scan checks each `SKILL.md` structure, frontmatter, relative links, progressive disclosure, helper code, and estimated trigger/invocation token cost. It does not test whether Codex selects the right Skill or completes a real Creator workflow. Scores are diagnostic signals; inspect each finding before changing instructions.

For behavior, curate realistic positive and near-miss prompts for one Skill, define observable success checks, then initialize its benchmark with `plugin-eval init-benchmark <skill-directory> --output <benchmark.json>`. Review the generated config and point its workspace at a disposable fixture before running `plugin-eval benchmark`. The starter scenarios are generic and need replacement with real task prompts. Keep live Creator MCP/editor operations out of benchmark runs; use fixtures and isolated workspaces. The targeted eight-Skill suite also supports a matched no-target-Skill control using an unrelated sentinel Skill; see `benchmarks/README.md` and record the control result when interpreting behavior lift.

Keep generated benchmark configs, run artifacts, and usage logs outside the published CLI package unless they are deliberately versioned as evaluation data.
