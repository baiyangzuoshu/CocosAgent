#!/usr/bin/env python3
"""Compare CCGS automation-mode resolution using its real helper scripts."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
MODES = ("collaborative", "guided", "autonomous")
KEYS = "automation,automation_always_ask"
LABELS = ("automation:", "automation_always_ask:")


def run_checked(command: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, text=True, capture_output=True, check=True)


def compare(source: Path) -> int:
    source = source.expanduser().resolve()
    project_yaml = source / "project.yaml"
    config_set = source / ".claude" / "scripts" / "config-set.sh"
    yaml_helper = source / ".claude" / "hooks" / "yaml-helper.sh"
    missing = [path for path in (project_yaml, config_set, yaml_helper) if not path.is_file()]
    if missing:
        print("缺少 CCGS 配置解析文件：", file=sys.stderr)
        for path in missing:
            print(f"  {path}", file=sys.stderr)
        return 1

    print(f"CCGS 源码：{source}")
    print("观察范围：真实 config-set / yaml-helper；只写入自动清理的临时副本。")
    try:
        with tempfile.TemporaryDirectory(prefix="ccgs-automation-modes-") as temp_dir:
            sandbox = Path(temp_dir)
            shutil.copy2(project_yaml, sandbox / "project.yaml")
            for mode in MODES:
                preview = run_checked(
                    [
                        "bash",
                        str(config_set),
                        "--root",
                        str(sandbox),
                        "modes.automation",
                        mode,
                        "--dry-run",
                    ],
                    cwd=REPO_ROOT,
                )
                if not any(
                    line.startswith("enum\tok\t")
                    for line in preview.stdout.splitlines()
                ):
                    print(f"配置预览未确认合法模式：{mode}", file=sys.stderr)
                    print(preview.stdout, file=sys.stderr)
                    return 1
                run_checked(
                    ["bash", str(config_set), "--root", str(sandbox), "modes.automation", mode],
                    cwd=REPO_ROOT,
                )
                result = run_checked(
                    ["bash", str(yaml_helper), "resolve_config", "--keys", KEYS],
                    cwd=sandbox,
                )
                lines = [
                    line
                    for line in result.stdout.splitlines()
                    if line.startswith(LABELS)
                ]
                if len(lines) != len(LABELS):
                    print(f"解析器没有返回完整的 automation 配置：{mode}", file=sys.stderr)
                    print(result.stdout, file=sys.stderr)
                    print(result.stderr, file=sys.stderr)
                    return 1
                print(f"\n## modes.automation = {mode}")
                print("\n".join(lines))
    except subprocess.CalledProcessError as error:
        print(f"CCGS 辅助脚本失败，退出码 {error.returncode}：", file=sys.stderr)
        if error.stdout:
            print(error.stdout, file=sys.stderr)
        if error.stderr:
            print(error.stderr, file=sys.stderr)
        return error.returncode or 1

    print("\n范围：没有改动源码快照，也没有运行完整 Claude Code Skill。")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="用 CCGS 自带配置脚本比较三种 automation 模式与 always-ask 列表。"
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="CCGS 源码目录；默认使用仓库内的快照",
    )
    args = parser.parse_args()
    return compare(args.source)


if __name__ == "__main__":
    sys.exit(main())
