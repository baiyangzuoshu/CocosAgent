#!/usr/bin/env python3
"""Compare files in two CCGS snapshots without modifying either one."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

IGNORED_PARTS = {
    ".git",
    "__pycache__",
    "worktrees",
    "session-state",
    "session-logs",
}


def inventory(root: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for path in root.rglob("*"):
        if not path.is_file() or IGNORED_PARTS.intersection(path.parts):
            continue
        if path.name == ".DS_Store":
            continue
        relative = path.relative_to(root).as_posix()
        result[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("older", type=Path, help="older CCGS source directory")
    parser.add_argument("newer", type=Path, help="newer CCGS source directory")
    args = parser.parse_args()

    older = args.older.expanduser().resolve()
    newer = args.newer.expanduser().resolve()
    for path in (older, newer):
        if not path.is_dir():
            parser.error(f"snapshot directory does not exist: {path}")

    old_files = inventory(older)
    new_files = inventory(newer)
    old_names = set(old_files)
    new_names = set(new_files)
    added = sorted(new_names - old_names)
    removed = sorted(old_names - new_names)
    changed = sorted(name for name in old_names & new_names if old_files[name] != new_files[name])

    print(f"Older snapshot: {older}")
    print(f"Newer snapshot: {newer}")
    for label, names in (("ADDED", added), ("REMOVED", removed), ("CHANGED", changed)):
        print(f"\n{label} ({len(names)})")
        for name in names:
            print(f"  {name}")
        if not names:
            print("  (none)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
