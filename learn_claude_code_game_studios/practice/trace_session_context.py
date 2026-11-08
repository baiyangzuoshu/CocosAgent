#!/usr/bin/env python3
"""Trace CCGS startup imports, on-demand docs, and SessionStart hook targets."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


IMPORT_RE = re.compile(r"^\s*@([^\s`]+)")
DOC_REF_RE = re.compile(r"`([^`]+\.md)`")
HOOK_TARGET_RE = re.compile(r"(?:\$\{CLAUDE_PROJECT_DIR\}|\$CLAUDE_PROJECT_DIR)/([^\s\"']+)")


def main() -> int:
    course_root = Path(__file__).resolve().parents[1]
    repo_root = course_root.parent
    default_source = repo_root / "engine" / "Claude-Code-Game-Studios"

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", default=str(default_source))
    args = parser.parse_args()
    source = Path(args.source).expanduser().resolve()
    root_doc = source / "CLAUDE.md"
    settings_file = source / ".claude" / "settings.json"

    missing = [path for path in (root_doc, settings_file) if not path.is_file()]
    if missing:
        parser.error("not a CCGS project; missing " + ", ".join(str(path) for path in missing))

    text = root_doc.read_text(encoding="utf-8")
    settings = json.loads(settings_file.read_text(encoding="utf-8"))
    imports: list[tuple[int, str, bool]] = []
    deferred: dict[str, int] = {}

    for line_number, line in enumerate(text.splitlines(), start=1):
        match = IMPORT_RE.match(line)
        if match:
            relative = match.group(1)
            imports.append((line_number, relative, (source / relative).is_file()))

        if re.search(r"\bon demand\b", line, flags=re.IGNORECASE):
            for path_match in DOC_REF_RE.finditer(line):
                relative = path_match.group(1)
                deferred.setdefault(relative, line_number)

    hooks: list[tuple[str, str, str | None, bool | None]] = []
    for registration in settings.get("hooks", {}).get("SessionStart", []):
        matcher = registration.get("matcher", "") or "(empty matcher)"
        for hook in registration.get("hooks", []):
            command = hook.get("command", "")
            target_match = HOOK_TARGET_RE.search(command)
            target = target_match.group(1) if target_match else None
            exists = (source / target).is_file() if target else None
            hooks.append((matcher, command, target, exists))

    failures = 0
    print(f"CCGS source: {source}")
    print("\nDirect @ imports in root CLAUDE.md:")
    for line_number, relative, exists in imports:
        state = "OK" if exists else "MISSING"
        print(f"  [{state}] CLAUDE.md:{line_number} -> {relative}")
        failures += not exists
    if not imports:
        print("  (none found)")

    print("\nDocs explicitly marked on demand in root CLAUDE.md:")
    for relative, line_number in deferred.items():
        exists = (source / relative).is_file()
        state = "OK" if exists else "MISSING"
        print(f"  [{state}] CLAUDE.md:{line_number} -> {relative}")
        failures += not exists
    if not deferred:
        print("  (none found)")

    print("\nSessionStart registrations in .claude/settings.json:")
    for matcher, command, target, exists in hooks:
        if target is None:
            state = "UNRESOLVED"
        else:
            state = "OK" if exists else "MISSING"
        target_text = target or "no project-relative target parsed"
        print(f"  [{state}] matcher={matcher}; target={target_text}")
        print(f"         {command}")
        failures += target is None or not exists
    if not hooks:
        print("  (none registered)")
        failures += 1

    print("\nThis is a static trace: it checks references and registration, not hook execution.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
