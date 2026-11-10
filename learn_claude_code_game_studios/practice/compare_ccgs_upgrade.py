#!/usr/bin/env python3
"""Read-only three-way file comparison for a CCGS template upgrade."""

from __future__ import annotations

import argparse
import hashlib
import os
import stat
import sys
import tempfile
from pathlib import Path


IGNORED_DIRS = {
    ".git",
    "__pycache__",
    "node_modules",
    ".godot",
    "library",
    "temp",
    "logs",
    "saved",
    "binaries",
    "deriveddatacache",
    "intermediate",
    "build",
    "builds",
    "bin",
    "obj",
    "out",
    "dist",
}
CATEGORIES = (
    "unchanged",
    "upstream_only",
    "local_only",
    "both_changed_same",
    "both_changed_differently",
    "upstream_added",
    "local_added",
    "both_added_same",
    "both_added_differently",
)


def file_signature(path: Path):
    if path.is_symlink():
        return ("symlink", os.readlink(path))
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    executable = bool(path.stat().st_mode & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH))
    return ("file", digest.hexdigest(), executable)


def inventory(root: Path):
    entries = {}
    errors = []
    for current, directories, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)
        directories.sort()
        filenames.sort()

        for directory in list(directories):
            path = current_path / directory
            if directory.casefold() in IGNORED_DIRS:
                directories.remove(directory)
                continue
            if path.is_symlink():
                relative = path.relative_to(root).as_posix()
                entries[relative] = ("symlink", os.readlink(path))
                directories.remove(directory)

        for filename in filenames:
            if filename == ".DS_Store":
                continue
            path = current_path / filename
            relative = path.relative_to(root).as_posix()
            try:
                entries[relative] = file_signature(path)
            except OSError as error:
                errors.append(f"{relative}: {error}")
    return entries, errors


def classify(base, local, upstream):
    missing = object()
    base_state = base if base is not None else missing
    local_state = local if local is not None else missing
    upstream_state = upstream if upstream is not None else missing

    if base_state is missing:
        if local_state is missing:
            return "upstream_added"
        if upstream_state is missing:
            return "local_added"
        if local_state == upstream_state:
            return "both_added_same"
        return "both_added_differently"

    local_changed = local_state != base_state
    upstream_changed = upstream_state != base_state
    if not local_changed and not upstream_changed:
        return "unchanged"
    if local_changed and not upstream_changed:
        return "local_only"
    if not local_changed and upstream_changed:
        return "upstream_only"
    if local_state == upstream_state:
        return "both_changed_same"
    return "both_changed_differently"


def describe(state):
    if state is None:
        return "deleted/absent"
    if state[0] == "symlink":
        return f"symlink -> {state[1]}"
    mode = "executable" if state[2] else "non-executable"
    return f"file {state[1][:12]} {mode}"


def compare_roots(base_root: Path, local_root: Path, upstream_root: Path, limit: int) -> int:
    roots = {
        "base": base_root.expanduser().resolve(),
        "local": local_root.expanduser().resolve(),
        "upstream": upstream_root.expanduser().resolve(),
    }
    for label, root in roots.items():
        if not root.is_dir() or not (root / "CLAUDE.md").is_file():
            print(f"{label} 不是 CCGS 根目录（缺少 CLAUDE.md）：{root}", file=sys.stderr)
            return 2

    snapshots = {}
    errors = []
    for label, root in roots.items():
        snapshots[label], found_errors = inventory(root)
        errors.extend(f"{label}/{message}" for message in found_errors)
    if errors:
        print("部分文件无法读取，不能形成完整对比：", file=sys.stderr)
        for error in errors[:20]:
            print(f"- {error}", file=sys.stderr)
        if len(errors) > 20:
            print(f"- 还有 {len(errors) - 20} 项", file=sys.stderr)
        return 1

    base, local, upstream = (snapshots[name] for name in ("base", "local", "upstream"))
    paths = sorted(set(base) | set(local) | set(upstream))
    groups = {category: [] for category in CATEGORIES}
    for path in paths:
        category = classify(base.get(path), local.get(path), upstream.get(path))
        groups[category].append(path)

    print("CCGS three-way upgrade inventory (read-only)")
    for label, root in roots.items():
        print(f"{label}: {root}")
    print(
        "Skipped directories: " + ", ".join(sorted(IGNORED_DIRS))
        + "; skipped files: .DS_Store"
    )
    print("\n## Path groups")
    for category in CATEGORIES:
        print(f"{category}: {len(groups[category])}")
        for path in groups[category][:limit]:
            print(
                f"  {path} | base={describe(base.get(path))}"
                f" | local={describe(local.get(path))}"
                f" | upstream={describe(upstream.get(path))}"
            )
        remaining = len(groups[category]) - limit
        if remaining > 0:
            print(f"  ... {remaining} more path(s); increase --limit to show them")

    print("\n## Reading the report")
    print("upstream_only/upstream_added: inspect the release-specific safe/merge/delete lists before taking.")
    print("local_only/local_added: preserve local edits and additions; review intentional local deletions.")
    print("both_changed_differently/both_added_differently: compare all three versions and merge manually.")
    print("both_changed_same/both_added_same: contents match, but still check release notes and dependencies.")
    print("This inventory never copies, deletes, merges or declares a path safe to overwrite.")
    return 0


def write_demo_tree(root: Path, files: dict[str, str]) -> None:
    for relative, content in files.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


def demo(limit: int) -> int:
    base_files = {
        "CLAUDE.md": "framework v1\n",
        "README.md": "template README v1\n",
        "project.yaml": "modes.rigor: standard\n",
        ".claude/settings.json": '{"hooks": []}\n',
        ".claude/agents/lead-programmer.md": "agent v1\n",
        ".claude/skills/start/SKILL.md": "start v1\n",
        ".claude/hooks/retired-hook.sh": "old hook\n",
    }
    local_files = {
        "CLAUDE.md": "framework v1\nlocal game notes\n",
        "README.md": "template README v1\n",
        "project.yaml": "modes.rigor: full\n",
        ".claude/settings.json": '{"hooks": []}\n',
        ".claude/agents/lead-programmer.md": "agent v1\nlocal additions\n",
        ".claude/skills/start/SKILL.md": "start v1.1\n",
        ".claude/hooks/retired-hook.sh": "old hook\n",
        ".claude/agents/custom-agent.md": "project-specific agent\n",
    }
    upstream_files = {
        "CLAUDE.md": "framework v2\n",
        "README.md": "template README v2\n",
        "project.yaml": "modes.rigor: standard\n",
        ".claude/settings.json": '{"hooks": ["new-hook"]}\n',
        ".claude/agents/lead-programmer.md": "agent v2\n",
        ".claude/skills/start/SKILL.md": "start v1.1\n",
        ".claude/rules/new-rule.md": "new framework rule\n",
    }

    with tempfile.TemporaryDirectory(prefix="ccgs-upgrade-demo-") as temporary:
        root = Path(temporary)
        roots = {name: root / name for name in ("base", "local", "upstream")}
        for path in roots.values():
            path.mkdir()
        write_demo_tree(roots["base"], base_files)
        write_demo_tree(roots["local"], local_files)
        write_demo_tree(roots["upstream"], upstream_files)
        print("DEMO: synthetic files in a temporary directory; not a CCGS release comparison.\n")
        return compare_roots(roots["base"], roots["local"], roots["upstream"], limit)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, help="common ancestor CCGS template tree")
    parser.add_argument("--local", type=Path, help="your project tree before upgrading")
    parser.add_argument("--upstream", type=Path, help="new CCGS template tree")
    parser.add_argument("--limit", type=int, default=20, help="maximum paths printed per group")
    parser.add_argument("--demo", action="store_true", help="compare a synthetic example in a temporary directory")
    args = parser.parse_args()

    if args.limit < 1:
        parser.error("--limit must be at least 1")
    if args.demo:
        if any((args.base, args.local, args.upstream)):
            parser.error("--demo cannot be combined with --base, --local or --upstream")
        return demo(args.limit)
    if not all((args.base, args.local, args.upstream)):
        parser.error("provide --base, --local and --upstream, or use --demo")
    return compare_roots(args.base, args.local, args.upstream, args.limit)


if __name__ == "__main__":
    sys.exit(main())
