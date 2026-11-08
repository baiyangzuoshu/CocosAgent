#!/usr/bin/env python3
"""Copy a CCGS snapshot into a fresh, isolated practice workspace."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def ignore_generated(directory: str, names: list[str]) -> set[str]:
    del directory
    ignored = {".git", "__pycache__", ".DS_Store"}
    return ignored.intersection(names)


def main() -> int:
    course_root = Path(__file__).resolve().parents[1]
    repo_root = course_root.parent
    default_source = repo_root / "engine" / "Claude-Code-Game-Studios"
    default_destination = Path(__file__).resolve().parent / "workspace"

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", default=str(default_source))
    parser.add_argument("destination", nargs="?", default=str(default_destination))
    args = parser.parse_args()

    source = Path(args.source).expanduser().resolve()
    destination = Path(args.destination).expanduser().resolve()

    if not source.is_dir() or not (source / ".claude" / "settings.json").is_file():
        parser.error(f"source is not a CCGS project: {source}")
    if destination.exists():
        parser.error(f"destination already exists; refusing to overwrite: {destination}")
    if destination == source or source in destination.parents:
        parser.error("destination must not be the source directory or one of its children")

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination, ignore=ignore_generated)
    print(f"Created isolated CCGS practice workspace: {destination}")
    print("Start Claude Code from that directory to exercise the real Skills and Hooks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
