#!/usr/bin/env python3
"""Inventory CCGS studio-tests metadata and run its read-only helper."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PROJECT = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
SECTIONS = {"skills", "agents"}


def parse_catalog(path: Path) -> Dict[str, Dict[str, Dict[str, str]]]:
    """Read the small, regular list structure used by studio-tests/catalog.yaml."""
    result: dict[str, dict[str, dict[str, str]]] = {"skills": {}, "agents": {}}
    section: Optional[str] = None
    current: Optional[Dict[str, str]] = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line in {"skills:", "agents:"}:
            section = line[:-1]
            current = None
            continue
        if section not in SECTIONS:
            continue
        item = re.match(r"^  - name:\s*(.*?)\s*$", line)
        if item:
            name = item.group(1).strip("\"'")
            current = {}
            result[section][name] = current
            continue
        field = re.match(r"^    ([A-Za-z_]+):\s*(.*?)\s*$", line)
        if field and current is not None:
            value = field.group(2).strip()
            if value in {'""', "''"}:
                value = ""
            else:
                value = value.strip("\"'")
            current[field.group(1)] = value
    return result


def live_names(project: Path) -> Dict[str, Set[str]]:
    skill_root = project / ".claude" / "skills"
    agent_root = project / ".claude" / "agents"
    skills = {
        item.parent.name
        for item in skill_root.glob("*/SKILL.md")
        if item.is_file()
    }
    agents = {
        item.stem
        for item in agent_root.rglob("*.md")
        if item.is_file()
    } if agent_root.is_dir() else set()
    return {"skills": skills, "agents": agents}


def rubric_metrics(project: Path, category: str) -> List[str]:
    rubric = project / "studio-tests" / "quality-rubric.md"
    if not rubric.is_file() or not category:
        return []
    content = rubric.read_text(encoding="utf-8")
    tick = chr(96)
    heading = re.search(
        r"^###\s+" + re.escape(tick) + re.escape(category) + re.escape(tick) + r"\s*$",
        content,
        re.MULTILINE,
    )
    if not heading:
        return []
    next_heading = re.search(r"^###\s+", content[heading.end():], re.MULTILINE)
    end = heading.end() + next_heading.start() if next_heading else len(content)
    section = content[heading.end():end]
    return re.findall(r"\*\*([A-Z]+\d+)\s+—", section)


def history_summary(entry: Dict[str, str], kind: str) -> str:
    fields = ("last_static", "last_spec", "last_category") if kind == "skills" else ("last_spec", "last_category")
    return ", ".join(f"{field}={entry.get(field) or '无记录'}" for field in fields)


def inspect(project_arg: Path, kind: str, name: str) -> int:
    project = project_arg.expanduser().resolve()
    if not project.is_dir():
        print(f"项目目录不存在：{project}", file=sys.stderr)
        return 1

    catalog_path = project / "studio-tests" / "catalog.yaml"
    helper_name = "skill-lint.sh" if kind == "skills" else "agent-check.sh"
    helper_path = project / ".claude" / "scripts" / helper_name
    if not catalog_path.is_file() or not helper_path.is_file():
        print("缺少 studio-tests/catalog.yaml 或对应的只读 helper。", file=sys.stderr)
        return 1

    catalog = parse_catalog(catalog_path)
    live = live_names(project)
    print(f"CCGS project: {project}")
    for group in ("skills", "agents"):
        registered = set(catalog[group])
        current = live[group]
        print(
            f"{group}: catalog={len(registered)} live={len(current)} "
            f"unregistered={len(current - registered)} stale={len(registered - current)}"
        )
    missing_specs = [
        f"{group}/{key}: {value.get('spec', '(no spec field)')}"
        for group, entries in catalog.items()
        for key, value in entries.items()
        if not value.get("spec") or not (project / value["spec"]).is_file()
    ]
    print(f"catalog specs missing: {len(missing_specs)}")
    for missing in missing_specs[:10]:
        print(f"- {missing}")
    if len(missing_specs) > 10:
        print(f"- ... and {len(missing_specs) - 10} more")

    entry = catalog[kind].get(name)
    if entry is None:
        print(f"目录中找不到 {kind} 条目：{name}", file=sys.stderr)
        return 1
    if name not in live[kind]:
        print(f"源码中找不到已登记的 {kind}：{name}", file=sys.stderr)
        return 1

    spec_relative = entry.get("spec", "")
    spec_path = project / spec_relative if spec_relative else None
    if kind == "skills":
        target_relative = f".claude/skills/{name}/SKILL.md"
    else:
        agent_root = project / ".claude" / "agents"
        matches = sorted(path for path in agent_root.rglob(f"{name}.md") if path.is_file())
        target_relative = matches[0].relative_to(project).as_posix() if matches else "(not found)"

    category = entry.get("category", "")
    print(f"target: {kind[:-1]} {name}")
    print(f"definition: {target_relative}")
    print(f"spec: {spec_relative or '(not registered)'}")
    print(f"category: {category or '(not set)'}; priority: {entry.get('priority', '(not set)')}")
    if spec_path and spec_path.is_file():
        spec_text = spec_path.read_text(encoding="utf-8")
        cases = len(re.findall(r"^###\s+Case\s+\d+:", spec_text, re.MULTILINE))
        assertions = len(re.findall(r"^\s*-\s+\[\s\]", spec_text, re.MULTILINE))
        print(f"spec cases: {cases}; checkbox assertions: {assertions}")
    else:
        print("spec cases: unavailable")
    metrics = rubric_metrics(project, category)
    print(f"rubric metrics: {', '.join(metrics) if metrics else '(no matching category section)'}")
    print(f"catalog history: {history_summary(entry, kind)}")

    if kind == "skills":
        command = ["bash", str(helper_path), name, "--root", str(project)]
    else:
        command = ["bash", str(helper_path), "--agent", name, str(project)]
    print("\n## helper observations (not a verdict)")
    print(f"run: bash .claude/scripts/{helper_name} {name} [project root]")
    completed = subprocess.run(command, cwd=project, text=True, capture_output=True, check=False)
    if completed.stdout:
        print(completed.stdout, end="" if completed.stdout.endswith("\n") else "\n")
    if completed.stderr:
        print(completed.stderr, file=sys.stderr, end="" if completed.stderr.endswith("\n") else "\n")
    print(f"helper exit: {completed.returncode}")
    print(
        "判读边界：此脚本只盘点注册项并调用只读 helper；它不会运行目标 Skill/Agent，"
        "也不评估 spec、rubric 或产生 /skill-test verdict。"
    )
    return 1 if completed.returncode != 0 else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=DEFAULT_PROJECT, help="CCGS 快照或隔离副本")
    parser.add_argument("--kind", choices=("skill", "agent"), default="skill", help="检查 Skill 或 Agent")
    parser.add_argument("--name", default="gate-check", help="catalog.yaml 中的条目名")
    args = parser.parse_args()
    return inspect(args.project, "skills" if args.kind == "skill" else "agents", args.name)


if __name__ == "__main__":
    sys.exit(main())
