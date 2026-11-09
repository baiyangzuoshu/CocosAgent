#!/usr/bin/env python3
"""Trace literal contracts, references, and helper paths for a CCGS Skill."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
DEFAULT_SKILL = "dev-story"
REFERENCE_RE = re.compile(r"(?<![\w./])references/([A-Za-z0-9_./-]+\.md)")
SCRIPT_RE = re.compile(r"\.claude/scripts/([A-Za-z0-9_.-]+\.(?:sh|py|awk|gd))")
DYNAMIC_PATH_RE = re.compile(r"\$\{CLAUDE_SKILL_DIR\}/([^\s\"'`]+)")
CONTRACT_RE = re.compile(r"\bCONTRACT\.md\b", re.IGNORECASE)
CONTRACT_HEAD_RE = re.compile(r"^##\s+(.+?)\s*$")
HELPER_HEADER_RE = re.compile(r"Usage:|Output:|Exit codes:|EMITS OBSERVATIONS|Reads only|never writes", re.IGNORECASE)


def shorten(value: str, limit: int = 190) -> str:
    value = value.strip()
    return value if len(value) <= limit else value[: limit - 1] + "…"


def show_path(path: Path, source: Path) -> str:
    try:
        return path.relative_to(source).as_posix()
    except ValueError:
        return path.as_posix()


def is_within(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def collect_paths(skill_lines: list[str], source: Path, skill_dir: Path):
    references: dict[Path, list[tuple[int, str]]] = {}
    scripts: dict[Path, list[tuple[int, str]]] = {}

    for line_no, line in enumerate(skill_lines, start=1):
        for match in REFERENCE_RE.finditer(line):
            path = (skill_dir / "references" / match.group(1)).resolve()
            references.setdefault(path, []).append((line_no, line.strip()))
        for match in SCRIPT_RE.finditer(line):
            path = (source / ".claude" / "scripts" / match.group(1)).resolve()
            scripts.setdefault(path, []).append((line_no, line.strip()))
        for match in DYNAMIC_PATH_RE.finditer(line):
            path = (skill_dir / match.group(1)).resolve()
            scripts.setdefault(path, []).append((line_no, line.strip()))
    return references, scripts


def print_helper_header(path: Path, source: Path) -> None:
    if not is_within(path, source) or path.suffix not in {".sh", ".awk", ".py"} or not path.is_file():
        return
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    items = []
    for i, line in enumerate(lines[:80], start=1):
        clean = line.lstrip().removeprefix("#").strip()
        if HELPER_HEADER_RE.search(clean):
            items.append(f"L{i} {shorten(clean)}")
            if len(items) == 3:
                break
    if items:
        print(f"  接口注释：{' | '.join(items)}")


def trace(source: Path, skill_name: str) -> bool:
    skill_dir = (source / ".claude" / "skills" / skill_name).resolve()
    if not is_within(skill_dir, source):
        print(f"Skill 路径超出源码目录：{skill_dir}")
        return False
    skill_path = skill_dir / "SKILL.md"
    if not skill_path.is_file():
        print(f"找不到 Skill：{skill_path}")
        return False

    skill_lines = skill_path.read_text(encoding="utf-8").splitlines()
    skill_text = "\n".join(skill_lines)
    contract_path = skill_dir / "CONTRACT.md"
    contract_lines = contract_path.read_text(encoding="utf-8").splitlines() if contract_path.is_file() else []

    print(f"CCGS 源码：{source}")
    print(f"Skill：{show_path(skill_path, source)}")
    if contract_path.is_file():
        linked = bool(CONTRACT_RE.search(skill_text))
        print(f"合同：{show_path(contract_path, source)}（存在；SKILL.md 中直接提到 CONTRACT.md：{'是' if linked else '否'}）")
        print("合同章节：")
        for i, line in enumerate(contract_lines, start=1):
            match = CONTRACT_HEAD_RE.match(line)
            if match:
                print(f"  L{i}: {match.group(1)}")
        if not linked:
            print("  注意：文件并列存在不表示 Skill 会自动加载该合同。")
    else:
        print("合同：此 Skill 目录没有 CONTRACT.md")

    references, scripts = collect_paths(skill_lines, source, skill_dir)
    print("显式相对参考资料（只报告引用位置和文件是否存在，不推断何时加载）：")
    if references:
        for path, occurrences in sorted(references.items(), key=lambda item: str(item[0])):
            state = "超出源码目录" if not is_within(path, source) else ("存在" if path.is_file() else "缺失")
            lines = ", ".join(f"L{line_no}" for line_no, _ in occurrences)
            print(f"  {show_path(path, source)} — {state}；引用于 {lines}")
            for line_no, text in occurrences[:2]:
                print(f"    L{line_no}: {shorten(text)}")
    else:
        print("  (未找到 references/*.md 路径)")

    print("脚本/辅助文件路径（静态命中；不会执行）：")
    if scripts:
        for path, occurrences in sorted(scripts.items(), key=lambda item: str(item[0])):
            state = "超出源码目录" if not is_within(path, source) else ("存在" if path.is_file() else "缺失")
            lines = ", ".join(f"L{line_no}" for line_no, _ in occurrences)
            print(f"  {show_path(path, source)} — {state}；引用于 {lines}")
            print_helper_header(path, source)
    else:
        print("  (未找到脚本路径)")
    print("范围：静态路径追踪，不证明文件实际被读取、脚本实际运行或输出被 Skill 正确解释。")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="追踪 CCGS Skill 邻接合同、条件参考资料和脚本路径。")
    parser.add_argument("skill", nargs="?", default=DEFAULT_SKILL, help="Skill 文件夹名；默认 dev-story")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="CCGS 源码目录；默认使用仓库内的快照")
    args = parser.parse_args()
    return 0 if trace(args.source.expanduser().resolve(), args.skill) else 1


if __name__ == "__main__":
    sys.exit(main())
