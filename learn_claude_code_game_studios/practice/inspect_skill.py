#!/usr/bin/env python3
"""Inspect CCGS Skill frontmatter and workflow structure using only the stdlib."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
IMPORTANT_FIELDS = (
    "name",
    "description",
    "argument-hint",
    "user-invocable",
    "disable-model-invocation",
    "allowed-tools",
    "model",
)
FIELD_RE = re.compile(r"^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$")
HEADING_RE = re.compile(r"^(#{1,3})\s+(.+?)\s*$")
ARGUMENT_RE = re.compile(r"\$ARGUMENTS(?:\[\d+\])?|\$[0-9]+")
INJECT_RE = re.compile(r"!`([^`]+)`")


def parse_frontmatter(lines: list[str]) -> tuple[int, dict[str, tuple[int, str]], str | None]:
    if not lines or lines[0].strip() != "---":
        return 0, {}, "SKILL.md 第一行不是 YAML frontmatter 起始标记 ---"

    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    except StopIteration:
        return 0, {}, "找不到 YAML frontmatter 结束标记 ---"

    fields: dict[str, tuple[int, str]] = {}
    for i, line in enumerate(lines[1:end], start=2):
        match = FIELD_RE.match(line)
        if match:
            fields[match.group(1)] = (i, match.group(2).strip())
    return end + 1, fields, None


def display_value(value: str, limit: int = 220) -> str:
    value = value.strip().strip('"').strip("'")
    if len(value) > limit:
        return value[: limit - 1] + "…"
    return value or "(空值)"


def list_skills(source: Path) -> int:
    skills_root = source / ".claude" / "skills"
    if not skills_root.is_dir():
        print(f"找不到 Skills 目录：{skills_root}")
        return 1

    paths = sorted(skills_root.glob("*/SKILL.md"))
    print(f"{len(paths)} 个顶层 Skill 定义（按文件夹名列出）：")
    for path in paths:
        print(f"  {path.parent.name}")
    return 0


def inspect_skill(source: Path, skill_name: str) -> bool:
    path = source / ".claude" / "skills" / skill_name / "SKILL.md"
    if not path.is_file():
        print(f"\n## {skill_name}\n找不到文件：{path}")
        return False

    lines = path.read_text(encoding="utf-8").splitlines()
    body_start, fields, error = parse_frontmatter(lines)
    print(f"\n## {skill_name} — {path.relative_to(source)}")
    if error:
        print(f"结构问题：{error}")
        body_start = 0
    else:
        declared_name = fields.get("name", (0, ""))[1].strip().strip('"').strip("'")
        print(f"目录名：{path.parent.name}")
        print(f"frontmatter name：{declared_name or '(未设置；需结合运行时版本确认名称规则)'}")
        if declared_name and declared_name != path.parent.name:
            print("名称差异：目录名与 frontmatter name 不同；不要只凭静态文件推断运行时冲突解析。")
        print("关键 frontmatter 字段（只读一行标量，不是完整 YAML 解析）：")
        for field in IMPORTANT_FIELDS:
            if field in fields:
                line_no, value = fields[field]
                print(f"  L{line_no} {field}: {display_value(value)}")
            else:
                print(f"  {field}: (未设置)")

    headings: list[tuple[int, str]] = []
    for i, line in enumerate(lines[body_start:], start=body_start + 1):
        match = HEADING_RE.match(line)
        if match:
            headings.append((i, f"{match.group(1)} {match.group(2)}"))
    print("正文结构（Markdown 一级至三级标题）：")
    if headings:
        for line_no, heading in headings[:40]:
            print(f"  L{line_no}: {heading}")
        if len(headings) > 40:
            print(f"  …另有 {len(headings) - 40} 个标题未显示")
    else:
        print("  (没有匹配到 Markdown 标题)")

    injections = [(i, INJECT_RE.findall(line)) for i, line in enumerate(lines, start=1) if INJECT_RE.search(line)]
    args = [(i, ARGUMENT_RE.findall(line)) for i, line in enumerate(lines[body_start:], start=body_start + 1) if ARGUMENT_RE.search(line)]
    print("正文中的动态输入线索：")
    if injections:
        for line_no, commands in injections:
            print(f"  L{line_no} 动态命令注入：{'; '.join(commands)}")
    else:
        print("  未找到 !`command` 形式的动态命令注入")
    if args:
        for line_no, tokens in args[:12]:
            print(f"  L{line_no} 参数占位符：{', '.join(dict.fromkeys(tokens))}")
        if len(args) > 12:
            print(f"  …另有 {len(args) - 12} 行参数占位符未显示")
    else:
        print("  未找到 $ARGUMENTS / $0 等占位符；参数也可能由正文规则直接解释")
    print("范围：静态检查文件结构，不加载 Skill、不校验完整 YAML，也不执行注入命令。")
    return error is None


def main() -> int:
    parser = argparse.ArgumentParser(description="列出或检查 CCGS Skill 的元数据与正文结构。")
    parser.add_argument("skills", nargs="*", help="Skill 文件夹名，例如 start team-combat")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="CCGS 源码目录；默认使用仓库内的快照")
    parser.add_argument("--list", action="store_true", help="列出 .claude/skills/ 下的顶层 Skill 文件夹")
    args = parser.parse_args()

    source = args.source.expanduser().resolve()
    if args.list:
        return list_skills(source)
    if not args.skills:
        parser.error("请指定至少一个 Skill 名称，或使用 --list")

    print(f"CCGS 源码：{source}")
    print("声明内容来自磁盘；静态检查不代表 Claude Code 已识别或调用该 Skill。")
    ok = True
    for skill_name in args.skills:
        ok = inspect_skill(source, skill_name) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
