#!/usr/bin/env python3
"""Read-only inventory of the CCGS design-to-architecture artifact chain."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PROJECT = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
TR_ID_RE = re.compile(r"^\s*-\s*id:\s*(TR-[A-Za-z0-9_-]+)\s*$", re.MULTILINE)
STANCE_ROW_RE = re.compile(
    r"^\s{2}-\s(?:state|contract|target_fps|system|purpose|pattern):\s*\S",
    re.MULTILINE,
)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return ""


def adr_status(path: Path) -> str:
    lines = read_text(path).splitlines()
    for index, line in enumerate(lines):
        if re.match(r"^##\s+Status\s*$", line, re.IGNORECASE):
            for candidate in lines[index + 1 : index + 5]:
                value = candidate.strip().strip("[]*_ `")
                if value and not value.startswith(">") and not value.startswith("<!--"):
                    return value.split("|")[0].strip()
    for line in lines:
        cleaned = re.sub(r"[*`>#]", "", line).strip()
        match = re.match(r"^Status\s*:\s*(.+)$", cleaned, re.IGNORECASE)
        if match:
            return match.group(1).strip().strip("[]")
    return "未标注"


def tr_entries(path: Path) -> list[tuple[str, str]]:
    text = read_text(path)
    matches = list(TR_ID_RE.finditer(text))
    entries: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        chunk = text[match.start() : end]
        status_match = re.search(r"^\s+status:\s*[\"']?([^\"'\n]+)", chunk, re.MULTILINE)
        entries.append((match.group(1), status_match.group(1).strip() if status_match else "active"))
    return entries


def format_presence(paths: list[Path], project: Path) -> str:
    if not paths:
        return "未找到"
    relative = [path.relative_to(project).as_posix() for path in paths]
    return ", ".join(relative)


def inspect(project: Path, workflow: str | None) -> int:
    project = project.expanduser().resolve()
    if not project.is_dir():
        print(f"项目目录不存在：{project}", file=sys.stderr)
        return 1

    concept_paths = [
        path
        for path in (
            project / "design" / "game-brief.md",
            project / "design" / "gdd" / "game-concept.md",
        )
        if path.is_file()
    ]
    systems_index = project / "design" / "gdd" / "systems-index.md"
    gdd_dir = project / "design" / "gdd"
    reserved_stems = {"game-concept", "game-pillars", "systems-index"}
    system_gdds = sorted(
        path
        for path in gdd_dir.glob("*.md")
        if path.stem not in reserved_stems and not path.stem.startswith("gdd-cross-review-")
    ) if gdd_dir.is_dir() else []

    architecture_dir = project / "docs" / "architecture"
    architecture = architecture_dir / "architecture.md"
    adrs = sorted(architecture_dir.glob("adr-*.md"))
    reviews = sorted(architecture_dir.glob("architecture-review-*.md"))
    traceability = architecture_dir / "requirements-traceability.md"
    tr_registry = architecture_dir / "tr-registry.yaml"
    stance_registry = project / "docs" / "registry" / "architecture.yaml"

    print(f"项目目录：{project}")
    print("范围：只读盘点文件存在性和少量状态字段；不执行 CCGS Skill，不判断内容质量，也不是 Gate。")
    print("\n环节 | 观察结果")
    print("--- | ---")
    print(f"概念 | {format_presence(concept_paths, project)}")
    print(f"系统索引 | {systems_index.relative_to(project) if systems_index.is_file() else '未找到'}")
    print(f"单系统 GDD | {len(system_gdds)} 个")
    print(f"总架构文档 | {architecture.relative_to(project) if architecture.is_file() else '未找到'}")
    print(f"ADR | {len(adrs)} 个")
    print(f"架构审查报告 | {len(reviews)} 个")
    print(f"需求追踪矩阵 | {traceability.relative_to(project) if traceability.is_file() else '未找到'}")

    if adrs:
        print("\nADR 状态（按文档 `## Status` 读取）：")
        for adr in adrs:
            print(f"- {adr.relative_to(project)} — {adr_status(adr)}")

    if tr_registry.is_file():
        entries = tr_entries(tr_registry)
        current = sum(status.lower() == "active" for _, status in entries)
        retired = len(entries) - current
        print(
            f"TR Registry | {tr_registry.relative_to(project)} — "
            f"{len(entries)} 个 ID（active {current}，非 active {retired}）"
        )
    else:
        print("TR Registry | 未找到")

    if stance_registry.is_file():
        stance_count = len(STANCE_ROW_RE.findall(read_text(stance_registry)))
        print(
            f"架构立场 Registry | {stance_registry.relative_to(project)} — "
            f"{stance_count} 条未注释记录"
        )
    else:
        print("架构立场 Registry | 未找到")

    if workflow == "minimal":
        print("\n档位提示：minimal 的默认路线使用一页 brief 直接拆 Stories；系统索引、单系统 GDD、架构和 ADR 缺失不自动代表缺口。")
    elif workflow in {"standard", "full"}:
        print(f"\n档位提示：workflow={workflow}；按该档位检查系统设计和技术设置产物。存在文件仍不等于内容通过审查。")
    else:
        print("\n档位提示：未提供 workflow；缺少文件只表示未找到，不能据此判定该项目未达 Gate。")
    print("TR Registry 与架构立场 Registry 是不同文件、记录不同事实；脚本分别读取它们。")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--project",
        type=Path,
        default=DEFAULT_PROJECT,
        help="CCGS 游戏项目根目录；默认盘点课程附带的模板快照",
    )
    parser.add_argument(
        "--workflow",
        choices=("minimal", "standard", "full"),
        help="可选：为缺失项提供工作流档位背景；不会读取或修改配置",
    )
    args = parser.parse_args()
    return inspect(args.project, args.workflow)


if __name__ == "__main__":
    sys.exit(main())
