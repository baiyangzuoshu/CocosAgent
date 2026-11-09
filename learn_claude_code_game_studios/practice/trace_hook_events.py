#!/usr/bin/env python3
"""Trace registered CCGS Hook events to their command files without running them."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
PROJECT_ROOT_RE = re.compile(r"(?:\$\{CLAUDE_PROJECT_DIR\}|\$CLAUDE_PROJECT_DIR)/([^\s\"']+)")


def trace(source: Path) -> int:
    source = source.expanduser().resolve()
    settings_path = source / ".claude" / "settings.json"
    if not settings_path.is_file():
        print(f"找不到 Hook 配置：{settings_path}", file=sys.stderr)
        return 1

    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"无法读取 Hook 配置：{error}", file=sys.stderr)
        return 1

    hooks = settings.get("hooks", {})
    if not isinstance(hooks, dict):
        print("settings.json 的 hooks 字段不是 JSON 对象", file=sys.stderr)
        return 1

    failures = 0
    event_count = 0
    command_count = 0
    print(f"CCGS source: {source}")
    print("来源：.claude/settings.json 的 hooks 字段")

    for event, registrations in hooks.items():
        event_count += 1
        print(f"\n## {event}")
        if not isinstance(registrations, list):
            print("  [INVALID] event registrations are not a JSON array")
            failures += 1
            continue

        for registration in registrations:
            if not isinstance(registration, dict):
                print("  [INVALID] registration is not a JSON object")
                failures += 1
                continue
            matcher = registration.get("matcher") or "(empty matcher)"
            print(f"  matcher={matcher}")
            commands = registration.get("hooks", [])
            if not isinstance(commands, list):
                print("    [INVALID] hooks is not a JSON array")
                failures += 1
                continue

            for hook in commands:
                command_count += 1
                if not isinstance(hook, dict):
                    print("    [INVALID] hook entry is not a JSON object")
                    failures += 1
                    continue
                command = hook.get("command", "")
                match = PROJECT_ROOT_RE.search(command)
                timeout = hook.get("timeout", "default")
                asynchronous = bool(hook.get("async", False))
                timing = f"timeout={timeout}s; async={str(asynchronous).lower()}"
                if not match:
                    print(f"    [UNRESOLVED] {command or '(empty command)'}; {timing}")
                    failures += 1
                    continue

                relative = Path(match.group(1))
                target = (source / relative).resolve()
                if source not in target.parents:
                    print(f"    [OUTSIDE SOURCE] {relative}; {timing}")
                    failures += 1
                elif target.is_file():
                    print(f"    [OK] {relative.as_posix()}; {timing}")
                else:
                    print(f"    [MISSING] {relative.as_posix()}; {timing}")
                    failures += 1

    print(f"\nSummary: {event_count} events, {command_count} registered commands, {failures} path/config issue(s).")
    print("范围：静态解析配置与文件存在性；不会运行 Hooks 或验证 Claude Code 的事件触发行为。")
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
