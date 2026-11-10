#!/usr/bin/env python3
"""Run CCGS's read-only stage and workflow-catalog observers."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PROJECT = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
PHASES = (
    "concept",
    "systems-design",
    "technical-setup",
    "pre-production",
    "production",
    "polish",
    "release",
)


def run_observer(project: Path, label: str, script: Path, args: list[str]) -> int:
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
    return result.returncode


def inspect(project: Path, phase: str) -> int:
    project = project.expanduser().resolve()
    if not project.is_dir():
        print(f"项目目录不存在：{project}", file=sys.stderr)
        return 1

    scripts_dir = project / ".claude" / "scripts"
    state_script = scripts_dir / "project-state.sh"
    artifact_script = scripts_dir / "artifact-check.sh"
    missing = [path for path in (state_script, artifact_script) if not path.is_file()]
    catalog = project / ".claude" / "docs" / "workflow-catalog.yaml"
    if not catalog.is_file():
        missing.append(catalog)
    if missing:
        print("缺少 CCGS 文件：", file=sys.stderr)
        for path in missing:
            print(f"- {path}", file=sys.stderr)
        return 1

    print(f"CCGS project: {project}")
    print("范围：只调用 project-state.sh 与 artifact-check.sh；不写文件、不调用 Claude Code Skill。")
    failures = 0
    failures += run_observer(project, "项目 stage 与文件阶段观察值", state_script, []) != 0
    failures += run_observer(
        project,
        f"阶段目录条目（{phase}）",
        artifact_script,
        ["--phase", phase],
    ) != 0
    failures += run_observer(
        project,
        "minimal 独立路线条目",
        artifact_script,
        ["--path", "minimal"],
    ) != 0

    print(
        "\n判读提示：stage / phase 是配置状态；phase_inferred 是从文件数量推得的观察值。"
        "artifact-check 的 PRESENT/ABSENT/NO_CHECK 也只是目录观察，"
        "不等于 gate verdict；需再按目标 gate 文件与 workflow tier 评估。"
    )
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
        "--phase",
        choices=PHASES,
        default="concept",
        help="要盘点的工作流阶段；默认 concept",
    )
    args = parser.parse_args()
    return inspect(args.project, args.phase)


if __name__ == "__main__":
    sys.exit(main())
