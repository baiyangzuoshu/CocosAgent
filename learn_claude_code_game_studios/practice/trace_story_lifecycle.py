#!/usr/bin/env python3
"""Run CCGS's read-only story status and fact/lint helpers for one project."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PROJECT = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"


def inspect(project: Path, granularity: str) -> int:
    project = project.expanduser().resolve()
    if not project.is_dir():
        print(f"项目目录不存在：{project}", file=sys.stderr)
        return 1

    scripts_dir = project / ".claude" / "scripts"
    commands = [
        ("Story 路线状态", scripts_dir / "story-status.sh", []),
        (
            "Story 字段与 readiness lint 事实",
            scripts_dir / "story-facts.sh",
            ["--lint", "--granularity", granularity, "--all"],
        ),
    ]
    missing = [script for _, script, _ in commands if not script.is_file()]
    if missing:
        print("缺少 CCGS helper：", file=sys.stderr)
        for path in missing:
            print(f"- {path}", file=sys.stderr)
        return 1

    print(f"CCGS project: {project}")
    print("范围：只运行项目自带的只读 story-status.sh 和 story-facts.sh；不调用 Skill、不写文件。")
    failures = 0
    for label, script, args in commands:
        display = "bash " + script.relative_to(project).as_posix()
        if args:
            display += " " + " ".join(args)
        print(f"\n## {label}\n$ {display}")
        result = subprocess.run(
            ["bash", str(script), *args],
            cwd=project,
            text=True,
            capture_output=True,
            check=False,
        )
        if result.stdout:
            print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
        if result.stderr:
            print(result.stderr, file=sys.stderr, end="" if result.stderr.endswith("\n") else "\n")
        print(f"exit: {result.returncode}")
        if result.returncode != 0:
            failures += 1

    print("\n说明：helper 输出事实与 lint 命中，不生成 READY / NEEDS WORK / BLOCKED verdict。无 Story 时，readiness 结果应为 NOT ASSESSED。")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--project",
        type=Path,
        default=DEFAULT_PROJECT,
        help="CCGS 项目或隔离副本根目录；默认使用课程中的本地快照",
    )
    parser.add_argument(
        "--granularity",
        choices=("coarse", "balanced", "fine"),
        default="coarse",
        help="story_granularity；必须与要检查的项目配置一致",
    )
    args = parser.parse_args()
    return inspect(args.project, args.granularity)


if __name__ == "__main__":
    sys.exit(main())
