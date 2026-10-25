# Skill evaluation

Use OpenAI's `plugin-eval` for static Skill analysis and curated, isolated Codex benchmarks. The Cocos CLI does not depend on this developer tool, and the evaluator is not shipped in the CLI tarball.

Install the OpenAI Codex plugin once with `codex plugin add plugin-eval@openai-curated`. The repository wrapper finds the installed plugin in `CODEX_HOME` by default, or accepts an explicit script path.

Run a static scan across the complete CLI Skills directory:

```sh
node cocos-creator-agent-cli/evals/analyze-skills.mjs --format markdown
node cocos-creator-agent-cli/evals/analyze-skills.mjs --format json --output /tmp/cocos-skills-eval.json
node cocos-creator-agent-cli/evals/analyze-skills.mjs --skill cocos2-scene-composition
```

The current 52-Skill snapshot is recorded in [skill-static-analysis-2026-10-25.md](skill-static-analysis-2026-10-25.md).
The latest layered acceptance progress is recorded in [skill-acceptance-status-2026-10-25.md](skill-acceptance-status-2026-10-25.md).

The static scan checks each `SKILL.md` structure, frontmatter, relative links, progressive disclosure, helper code, and estimated trigger/invocation token cost. It does not test whether Codex selects the right Skill or completes a real Creator workflow. Scores are diagnostic signals; inspect each finding before changing instructions.

For behavior, the checked-in benchmark suite contains two curated prompts for each of the 52 Skills: one representative task and one adjacent-scope boundary. Each run uses an isolated Codex home and offline fixture; a deterministic verifier checks route, decision, evidence, and mutation/claim boundaries. The phases cover all 52 current Skills, the 13 Skills changed since the pinned baseline, and a 15-Skill no-target control set. See [benchmarks/README.md](benchmarks/README.md) for commands and limits.

Creator editor and persistence acceptance is separate from the offline suite. The 19 editor/content Skills listed in the benchmark README require an identity-checked Creator 2.4.15 project and actual readback. Do not treat an offline plan or static finding as real editor acceptance.

Keep generated benchmark configs, run artifacts, and usage logs outside the published CLI package unless they are deliberately versioned as evaluation data.
