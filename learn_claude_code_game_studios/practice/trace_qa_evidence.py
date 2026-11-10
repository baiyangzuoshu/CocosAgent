#!/usr/bin/env python3
"""Preview CCGS's test-run plan and inventory retained QA evidence."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PROJECT = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif"}
VIDEO_SUFFIXES = {".mp4", ".webm", ".mov"}


def inventory(project: Path) -> None:
    stories_root = project / "production" / "epics"
    stories = sorted(stories_root.rglob("story-*.md")) if stories_root.is_dir() else []

    evidence_root = project / "production" / "qa" / "evidence"
    evidence = sorted(path for path in evidence_root.rglob("*") if path.is_file()) if evidence_root.is_dir() else []
    images = [path for path in evidence if path.suffix.lower() in IMAGE_SUFFIXES]
    videos = [path for path in evidence if path.suffix.lower() in VIDEO_SUFFIXES]
    docs = [path for path in evidence if path.suffix.lower() == ".md"]
    stamps = [path for path in evidence if path.name == "stamp.txt"]

    qa_root = project / "production" / "qa"
    smoke_reports = sorted(qa_root.glob("smoke-*.md")) if qa_root.is_dir() else []
    playtest_root = qa_root / "playtests"
    playtest_reports = sorted(playtest_root.glob("*.md")) if playtest_root.is_dir() else []

    print("\n## QA 文件盘点（只报告存在性）")
    print(f"stories: {len(stories)}")
    print(f"retained images: {len(images)}")
    print(f"retained videos: {len(videos)}")
    print(f"evidence documents: {len(docs)}")
    print(f"code receipt stamps: {len(stamps)}")
    print(f"smoke reports: {len(smoke_reports)}")
    print(f"playtest reports: {len(playtest_reports)}")

    for label, paths in (
        ("Images", images),
        ("Videos", videos),
        ("Evidence docs", docs),
        ("Stamps", stamps),
        ("Smoke reports", smoke_reports),
        ("Playtest reports", playtest_reports),
    ):
        if paths:
            print(f"{label} paths:")
            for path in paths:
                print(f"- {path.relative_to(project).as_posix()}")

    if not stories:
        print("范围提示：未找到 Story；空目录盘点不能判为证据通过或缺失。")


def inspect(project: Path, engine: str) -> int:
    project = project.expanduser().resolve()
    if not project.is_dir():
        print(f"项目目录不存在：{project}", file=sys.stderr)
        return 1

    runner = project / ".claude" / "scripts" / "test-run.sh"
    if not runner.is_file():
        print(f"缺少 CCGS helper：{runner}", file=sys.stderr)
        return 1

    print(f"CCGS project: {project}")
    print(f"范围：只调用 test-run.sh --dry-run（引擎={engine}）并盘点 QA 文件；不运行游戏或测试、不写文件。")
    command = ["bash", str(runner), engine, "--dry-run", "--root", str(project)]
    print("\n## 自动化测试运行计划（dry-run）")
    print("执行：test-run.sh " + engine + " --dry-run --root " + str(project))
    result = subprocess.run(
        command,
        cwd=project,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.stdout:
        print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
    if result.stderr:
        print(result.stderr, file=sys.stderr, end="" if result.stderr.endswith("\n") else "\n")
    print(f"helper exit: {result.returncode} (不是测试 verdict)")

    inventory(project)
    print(
        "\n判读提示：dry-run 只显示计划；test-run.sh 输出观察行，smoke-check 才按规则形成 verdict。"
        "文件存在不代表测试运行过、截图已检查或证据覆盖了 AC。"
    )
    return 1 if result.returncode != 0 else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--project",
        type=Path,
        default=DEFAULT_PROJECT,
        help="CCGS 项目或隔离副本根目录；默认使用课程中的本地快照",
    )
    parser.add_argument(
        "--engine",
        choices=("godot", "unity", "unreal"),
        required=True,
        help="目标项目配置的引擎；dry-run 不会启动引擎",
    )
    args = parser.parse_args()
    return inspect(args.project, args.engine)


if __name__ == "__main__":
    sys.exit(main())
