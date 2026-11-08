#!/usr/bin/env python3
"""Report the inventory of a local Claude Code Game Studios snapshot."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def main() -> int:
    course_root = Path(__file__).resolve().parents[1]
    repo_root = course_root.parent
    default_source = repo_root / "engine" / "Claude-Code-Game-Studios"

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "source",
        nargs="?",
        default=str(default_source),
        help="path to the CCGS source snapshot",
    )
    args = parser.parse_args()
    source = Path(args.source).expanduser().resolve()

    required = [
        source / "CLAUDE.md",
        source / "project.yaml",
        source / ".claude" / "settings.json",
    ]
    missing = [path for path in required if not path.is_file()]
    if missing:
        parser.error("not a CCGS project; missing " + ", ".join(str(p) for p in missing))

    project_yaml = (source / "project.yaml").read_text(encoding="utf-8")
    version_match = re.search(r"(?m)^\s+version:\s*([^\s#]+)\s*$", project_yaml)
    settings = json.loads((source / ".claude" / "settings.json").read_text(encoding="utf-8"))

    agents = list((source / ".claude" / "agents").rglob("*.md"))
    skills = list((source / ".claude" / "skills").rglob("SKILL.md"))
    hook_scripts = list((source / ".claude" / "hooks").glob("*.sh"))
    rules = list((source / ".claude" / "rules").glob("*.md"))
    registered_hooks = sum(
        len(matcher.get("hooks", []))
        for event in settings.get("hooks", {}).values()
        for matcher in event
    )

    print(f"Source: {source}")
    print(f"Framework version: {version_match.group(1) if version_match else 'not found'}")
    print(f"Agent definitions: {len(agents)}")
    print(f"Skill entry files: {len(skills)}")
    print(f"Registered hook commands: {registered_hooks}")
    print(f"Hook shell files: {len(hook_scripts)}")
    print(f"Path rules: {len(rules)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
