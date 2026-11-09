#!/usr/bin/env python3
"""List CCGS Rule path frontmatter without trying to emulate Claude Code globbing."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
LIST_ITEM_RE = re.compile(r"^\s+-\s+(.*?)\s*$")


def unquote(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def parse_paths(path: Path) -> tuple[list[str], bool, str | None]:
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        return [], False, "frontmatter does not start with ---"
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    except StopIteration:
        return [], False, "frontmatter closing --- is missing"

    patterns: list[str] = []
    has_paths = False
    in_paths_list = False
    for line in lines[1:end]:
        if not line or line.lstrip().startswith("#"):
            continue
        if line[:1].isspace():
            if in_paths_list:
                match = LIST_ITEM_RE.match(line)
                if match:
                    patterns.append(unquote(match.group(1)))
            continue
        in_paths_list = False
        if line.startswith("paths:"):
            has_paths = True
            value = line.partition(":")[2].strip()
            if value.startswith("[") and value.endswith("]"):
                patterns.extend(unquote(item) for item in value[1:-1].split(",") if item.strip())
            elif value:
                patterns.append(unquote(value))
            else:
                in_paths_list = True
    return patterns, has_paths, None


def trace(source: Path) -> int:
    source = source.expanduser().resolve()
    rules_dir = source / ".claude" / "rules"
    settings_path = source / ".claude" / "settings.json"
    if not rules_dir.is_dir() or not settings_path.is_file():
        print(f"不是完整的 CCGS 源码目录：{source}", file=sys.stderr)
        return 1

    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"无法读取 settings.json：{error}", file=sys.stderr)
        return 1

    rules = sorted(rules_dir.glob("*.md"))
    failures = 0
    scoped = 0
    session_wide = 0
    print(f"CCGS source: {source}")
    print(f"Rules: {len(rules)} file(s) under .claude/rules/")

    for path in rules:
        patterns, has_paths, error = parse_paths(path)
        if error:
            print(f"\n[INVALID] {path.name}: {error}")
            failures += 1
            continue
        if has_paths and patterns:
            scoped += 1
            print(f"\n[PATH-SCOPED] {path.name}")
            for pattern in patterns:
                print(f"  {pattern}")
        elif not has_paths:
            session_wide += 1
            print(f"\n[SESSION-WIDE] {path.name} (no paths: frontmatter)")
        else:
            print(f"\n[EMPTY PATHS] {path.name} (verify the rule metadata)")
            failures += 1

    hooks = settings.get("hooks", {})
    loaded_registered = isinstance(hooks, dict) and bool(hooks.get("InstructionsLoaded"))
    logger = source / ".claude" / "hooks" / "log-instructions.sh"
    logger_state = "exists" if logger.is_file() else "missing"
    print(f"\nInstructionsLoaded registered in settings.json: {'yes' if loaded_registered else 'no'}")
    print(f"log-instructions.sh: {logger_state}")
    print(
        f"Summary: {scoped} path-scoped rule(s), {session_wide} session-wide rule(s), "
        f"{failures} metadata issue(s)."
    )
    print("范围：只列出 frontmatter 和诊断 Hook 注册状态；不模拟 glob 匹配，也不证明规则在运行时加载过。")
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
    return trace(args.source)


if __name__ == "__main__":
    sys.exit(main())
