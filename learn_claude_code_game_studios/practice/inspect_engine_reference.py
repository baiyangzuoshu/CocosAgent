#!/usr/bin/env python3
"""Inspect CCGS engine reference pins and project-engine configuration."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
VERSION_ROW_RE = re.compile(r"^\|\s*\*\*([^*]+)\*\*\s*\|\s*(.*?)\s*\|\s*$")


def scalar(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def read_engine_config(path: Path) -> dict[str, str]:
    """Read the root-level engine.name/version fields without a YAML dependency."""
    if not path.is_file():
        return {}
    lines = path.read_text(encoding="utf-8").splitlines()
    start = next(
        (i for i, line in enumerate(lines) if re.match(r"^engine\s*:\s*(?:#.*)?$", line)),
        None,
    )
    if start is None:
        return {}

    fields: dict[str, str] = {}
    for line in lines[start + 1 :]:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line[:1].isspace():
            break
        match = re.match(r"^\s{2}(name|version)\s*:\s*(.*?)\s*$", line)
        if match:
            value = scalar(match.group(2).split(" #", 1)[0])
            if value and not value.startswith("["):
                fields[match.group(1)] = value
    return fields


def read_reference_import(path: Path) -> str | None:
    if not path.is_file():
        return None
    lines = path.read_text(encoding="utf-8").splitlines()
    marker = next((i for i, line in enumerate(lines) if "ENGINE-REFERENCE-IMPORT" in line), None)
    if marker is None:
        return None
    for line in lines[marker + 1 :]:
        match = re.match(r"^@docs/engine-reference/([^/]+)/VERSION\.md\s*$", line.strip())
        if match:
            return match.group(1)
        if line.startswith("## "):
            break
    return None


def read_version_fields(path: Path) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = VERSION_ROW_RE.match(line)
        if match:
            fields[match.group(1).strip()] = match.group(2).strip()
    return fields


def canonical_engine(name: str | None) -> str | None:
    if not name:
        return None
    normalized = name.strip().lower()
    if normalized.endswith(" engine"):
        normalized = normalized[: -len(" engine")]
    return normalized


def inspect(source: Path, requested_engine: str | None) -> int:
    source = source.expanduser().resolve()
    docs_root = source / "docs" / "engine-reference"
    project_path = source / "project.yaml"
    if not docs_root.is_dir():
        print(f"找不到引擎参考资料目录：{docs_root}", file=sys.stderr)
        return 1

    project_engine = read_engine_config(project_path)
    configured_name = project_engine.get("name")
    configured_version = project_engine.get("version")
    default_import = read_reference_import(source / "CLAUDE.md")
    selected = canonical_engine(requested_engine or configured_name)

    print(f"CCGS source: {source}")
    print("项目配置来源：project.yaml 的 engine.name / engine.version（若存在）")
    if configured_name or configured_version:
        print(f"project.yaml engine: {configured_name or '(name not set)'} / {configured_version or '(version not set)'}")
    else:
        print("project.yaml engine: not configured")
    print(f"CLAUDE.md reference import: {default_import or 'not found'} (template import; not project detection)")
    if requested_engine:
        print(f"Reference filter: {requested_engine} (provided by caller; not project detection)")

    directories = sorted(path for path in docs_root.iterdir() if path.is_dir())
    available: list[str] = []
    for directory in directories:
        version_path = directory / "VERSION.md"
        if version_path.is_file():
            available.append(directory.name)

    print(f"\nReference engines with VERSION.md: {', '.join(available) or '(none)'}")
    if selected and selected not in available:
        print(f"No pinned reference directory for {selected!r} in this snapshot.")
        print("The available references are not a substitute for a missing engine's documentation.")
        return 0

    targets = [docs_root / selected] if selected else [docs_root / name for name in available]
    for directory in targets:
        version_path = directory / "VERSION.md"
        fields = read_version_fields(version_path)
        print(f"\n## {directory.name}")
        for label in (
            "Engine Version",
            "Installed at pin time",
            "Project Pinned",
            "Last Docs Verified",
            "LLM Knowledge Cutoff",
        ):
            if label in fields:
                print(f"{label}: {fields[label]}")

        top_level = sorted(path.name for path in directory.glob("*.md") if path.name != "VERSION.md")
        modules = sorted(path.name for path in (directory / "modules").glob("*.md")) if (directory / "modules").is_dir() else []
        plugins = sorted(path.name for path in (directory / "plugins").glob("*.md")) if (directory / "plugins").is_dir() else []
        print(f"Reference files: top-level={', '.join(top_level) or '(none)'}")
        print(f"Subsystem modules: {len(modules)}")
        print(f"Plugin references: {len(plugins)}")

    print("\n范围：静态读取 project.yaml、CLAUDE.md 和 VERSION.md；不探测本机引擎、不联网核验文档，也不判定 API 是否可编译。")
    if not configured_name and not requested_engine:
        print("当前快照未配置项目引擎；CLAUDE.md 中的默认导入不能单独证明游戏项目使用该引擎。")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="CCGS 源码目录；默认使用仓库内的快照",
    )
    parser.add_argument(
        "--engine",
        help="只查看一个已知引擎的参考目录；这是筛选值，不是自动识别",
    )
    args = parser.parse_args()
    return inspect(args.source, args.engine)


if __name__ == "__main__":
    sys.exit(main())
