#!/usr/bin/env python3
"""Print line-numbered delegation and dependency evidence from CCGS team Skills.

This is a small source-reading aid, not a Claude Code scheduler or runtime trace.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
DEFAULT_SKILLS = ("team-combat", "team-live-ops")
PHASE_RE = re.compile(r"^### Phase\s+(\d+)\s*:\s*(.+?)\s*$")
ROLE_RE = re.compile(r"`subagent_type:\s*([^`]+)`")
MARKERS = {
    "并行": re.compile(r"parallel", re.IGNORECASE),
    "依赖/先后": re.compile(r"start only after|after both|depends? on|before proceeding", re.IGNORECASE),
    "门禁/决策": re.compile(r"AskUserQuestion|phase gate|approval|approve", re.IGNORECASE),
    "阻塞/恢复": re.compile(r"BLOCKED|blocked|Error Recovery|partial report|surface it", re.IGNORECASE),
}


def numbered_matches(lines: list[str], pattern: re.Pattern[str], limit: int = 7) -> list[str]:
    found = [f"  L{i}: {line.strip()}" for i, line in enumerate(lines, start=1) if pattern.search(line)]
    if len(found) > limit:
        found = found[:limit] + [f"  …另有 {len(found) - limit} 条匹配未显示"]
    return found


def trace_skill(source: Path, name: str) -> bool:
    path = source / ".claude" / "skills" / name / "SKILL.md"
    if not path.is_file():
        print(f"\n## {name}\n找不到文件：{path}")
        return False

    lines = path.read_text(encoding="utf-8").splitlines()
    print(f"\n## {name} — {path.relative_to(source)}")
    print("阶段标题：")
    for i, line in enumerate(lines, start=1):
        match = PHASE_RE.match(line)
        if match:
            print(f"  L{i}: Phase {match.group(1)} — {match.group(2)}")

    roles: list[tuple[int, str]] = []
    for i, line in enumerate(lines, start=1):
        for match in ROLE_RE.finditer(line):
            role = match.group(1).strip()
            if role and (i, role) not in roles:
                roles.append((i, role))
    if roles:
        print("显式 subagent_type 声明（这里只列声明，不代表一次会话实际调用）：")
        for line_no, role in roles:
            print(f"  L{line_no}: {role}")
    else:
        print("没有匹配到 subagent_type 声明；需继续读 Skill 的委派描述。")

    print("流程标记（原文命中，需结合上下文解释）：")
    for label, pattern in MARKERS.items():
        hits = numbered_matches(lines, pattern)
        if hits:
            print(f"{label}：")
            print("\n".join(hits))
    return True


def trace_coordination(source: Path) -> bool:
    path = source / ".claude" / "docs" / "coordination-rules.md"
    if not path.is_file():
        print(f"\n## coordination-rules\n找不到文件：{path}")
        return False

    lines = path.read_text(encoding="utf-8").splitlines()
    markers = re.compile(
        r"Vertical Delegation|Horizontal Consultation|Conflict Resolution|Change Propagation|"
        r"No Unilateral Cross-Domain|shared parent|creative-director|technical-director|producer|"
        r"independent `Agent` calls|BLOCKED|partial report",
        re.IGNORECASE,
    )
    print(f"\n## 全局升级与并行规则 — {path.relative_to(source)}")
    hits = numbered_matches(lines, markers, limit=16)
    print("\n".join(hits) if hits else "未找到匹配规则。")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="按行号提取 CCGS team Skill 的阶段、委派角色、并行/依赖/门禁/阻塞线索。"
    )
    parser.add_argument("skills", nargs="*", help="Skill 名称，例如 team-combat；默认追踪 team-combat 与 team-live-ops")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="CCGS 源码目录；默认使用仓库内的 1.2.0 快照")
    args = parser.parse_args()

    source = args.source.expanduser().resolve()
    skills = args.skills or list(DEFAULT_SKILLS)
    print(f"CCGS 源码：{source}")
    print("注意：下列内容是静态文本命中，不会调用 Agent，也不证明某次会话实际委派或并行执行。")

    ok = trace_coordination(source)
    for skill in skills:
        ok = trace_skill(source, skill) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
