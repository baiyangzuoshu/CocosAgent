#!/usr/bin/env python3
"""Trace the entry points, permissions, and handoffs of four CCGS Skills."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"

SKILLS = {
    "help": {
        "references": [],
        "signals": [
            ("declares read-only behavior", "this skill is read-only"),
            ("uses the workflow catalog", "workflow-catalog.yaml"),
            ("checks tracked artifacts", "artifact-check.sh"),
            ("points to full gap analysis", "full gap analysis"),
        ],
    },
    "project-stage-detect": {
        "references": [".claude/docs/templates/project-stage-report.md"],
        "signals": [
            ("uses deterministic artifact scan", "artifact-check.sh"),
            ("compares configured and observed stage", "always run the heuristics"),
            ("reports unknown code root as unassessed", "not assessed — code root unresolved"),
            ("requests approval before writing", "request approval before writing"),
            ("names the optional report path", "production/project-stage-report.md"),
        ],
    },
    "start": {
        "references": [],
        "signals": [
            ("reads project facts", "project-state.sh"),
            ("asks the user's starting point", "where are you starting from"),
            ("persists settings only after consent", "only after an explicit yes"),
            ("hands off without running the next Skill", "never runs that step itself"),
            ("routes existing projects", "/project-stage-detect"),
        ],
    },
    "setup-engine": {
        "references": [".claude/skills/setup-engine/references/3-version.md"],
        "signals": [
            ("delegates version lookup details", "references/3-version.md"),
            ("probes the installed engine", "probe for the binary"),
            ("forbids guessing a version", "never guess an engine version"),
            ("uses the primary project config", "is the primary config store"),
        ],
    },
}


def read_frontmatter(path: Path) -> tuple[dict[str, str], str | None]:
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, "frontmatter does not start with ---"
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    except StopIteration:
        return {}, "frontmatter closing --- is missing"

    fields: dict[str, str] = {}
    for line in lines[1:end]:
        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*?)\s*$", line)
        if match:
            value = match.group(2).strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
                value = value[1:-1]
            fields[match.group(1)] = value
    return fields, None


def tool_names(allowed_tools: str) -> set[str]:
    names: set[str] = set()
    for item in allowed_tools.split(","):
        match = re.match(r"\s*([A-Za-z][A-Za-z0-9_-]*)", item)
        if match:
            names.add(match.group(1))
    return names


def inspect(source: Path) -> int:
    source = source.expanduser().resolve()
    failures = 0
    print(f"CCGS source: {source}")
    print("范围：读取 Skill frontmatter 与正文标记；不调用 Skill、Hook 或项目脚本。")

    for name, spec in SKILLS.items():
        skill_path = source / ".claude" / "skills" / name / "SKILL.md"
        reference_paths = [source / relative for relative in spec["references"]]
        absent = [path for path in [skill_path, *reference_paths] if not path.is_file()]
        if absent:
            for path in absent:
                print(f"\n[MISSING] {path.relative_to(source)}")
            failures += len(absent)
            continue

        frontmatter, error = read_frontmatter(skill_path)
        if error:
            print(f"\n[INVALID] {skill_path.relative_to(source)}: {error}")
            failures += 1
            continue

        body = "\n".join(path.read_text(encoding="utf-8") for path in [skill_path, *reference_paths]).lower()
        allowed = tool_names(frontmatter.get("allowed-tools", ""))
        invocable = frontmatter.get("user-invocable", "not set")
        print(f"\n## /{name}")
        print(f"name={frontmatter.get('name', '(missing)')}; user-invocable={invocable}; model={frontmatter.get('model', '(not set)')}")
        print(
            "tool capabilities: "
            + ", ".join(f"{tool}={'yes' if tool in allowed else 'no'}" for tool in ("Write", "Edit", "AskUserQuestion", "WebSearch"))
        )
        if frontmatter.get("name") != name:
            print(f"[MISMATCH] frontmatter name should match directory {name!r}")
            failures += 1
        if invocable.lower() != "true":
            print("[CHECK] Skill is not explicitly user-invocable")

        for label, marker in spec["signals"]:
            if marker.lower() in body:
                print(f"[OK] {label}")
            else:
                print(f"[MISSING SIGNAL] {label}: {marker}")
                failures += 1
        if name == "start":
            says_brainstorm_first = "list `/brainstorm` first and `/setup-engine` second" in body
            lists_setup_first = "concept: `/setup-engine` → `/brainstorm`" in body
            if says_brainstorm_first and lists_setup_first:
                print("[REVIEW] Phase 6 has conflicting Concept order guidance; reconcile it before claiming one route order.")

    state_helper = source / ".claude" / "scripts" / "project-state.sh"
    config_resolution = source / ".claude" / "docs" / "config-resolution.md"
    if state_helper.is_file() and config_resolution.is_file():
        helper_text = state_helper.read_text(encoding="utf-8")
        resolution_text = config_resolution.read_text(encoding="utf-8")
        local_whitelist = next(
            (line for line in resolution_text.splitlines() if "project.local.yaml" in line and "whitelist" in line),
            "",
        )
        if (
            "yaml_get project.local.yaml engine.name" in helper_text
            and "12 keys" in local_whitelist
            and "engine.name" not in local_whitelist
        ):
            print(
                "\n[REVIEW] project-state.sh reads engine.name from project.local.yaml, "
                "while config-resolution.md limits local values to a 12-key whitelist that omits engine.name."
            )

    print(f"\nSummary: {len(SKILLS)} entry Skills inspected, {failures} missing/mismatched signal(s).")
    print("Permission declarations show possible tool access; they do not prove the Skill ran or changed files.")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="CCGS 源码目录；默认使用仓库内的快照",
    )
    args = parser.parse_args()
    return inspect(args.source)


if __name__ == "__main__":
    sys.exit(main())
