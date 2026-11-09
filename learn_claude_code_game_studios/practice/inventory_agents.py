#!/usr/bin/env python3
"""Inventory CCGS agent definitions and compare them with the agent roster."""

from __future__ import annotations

import argparse
import re
from collections import Counter
from pathlib import Path


FRONTMATTER_FIELDS = {"name", "description", "model"}
ROSTER_NAME_RE = re.compile(r"^\|\s*`([^`]+)`\s*\|", re.MULTILINE)


def unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def parse_frontmatter(text: str) -> dict[str, str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}

    fields: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if not line or line[0].isspace() or ":" not in line:
            continue
        key, _, raw_value = line.partition(":")
        if key not in FRONTMATTER_FIELDS:
            continue
        value = raw_value.strip()
        if value in {">", ">-", "|", "|-"}:
            continue
        fields[key] = unquote(value)
    return fields


def main() -> int:
    course_root = Path(__file__).resolve().parents[1]
    repo_root = course_root.parent
    default_source = repo_root / "engine" / "Claude-Code-Game-Studios"

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", default=str(default_source))
    parser.add_argument("--search", help="literal, case-insensitive search in agent name and description")
    args = parser.parse_args()

    source = Path(args.source).expanduser().resolve()
    agent_dir = source / ".claude" / "agents"
    roster_file = source / ".claude" / "docs" / "agent-roster.md"
    if not agent_dir.is_dir() or not roster_file.is_file():
        parser.error(f"not a CCGS source snapshot: {source}")

    definitions: list[tuple[Path, dict[str, str]]] = []
    errors: list[str] = []
    for path in sorted(agent_dir.rglob("*.md")):
        fields = parse_frontmatter(path.read_text(encoding="utf-8"))
        if not fields.get("name"):
            errors.append(f"missing name: {path.relative_to(source)}")
        if not fields.get("description"):
            errors.append(f"missing description: {path.relative_to(source)}")
        definitions.append((path, fields))

    roster_names = ROSTER_NAME_RE.findall(roster_file.read_text(encoding="utf-8"))
    definition_names = [fields.get("name", "") for _, fields in definitions]
    duplicates = sorted(name for name, count in Counter(definition_names).items() if name and count > 1)
    unlisted = sorted(set(definition_names) - set(roster_names))
    missing_files = sorted(set(roster_names) - set(definition_names))
    model_counts = Counter(fields.get("model", "(unset)") for _, fields in definitions)

    print(f"CCGS source: {source}")
    print(f"Agent definitions: {len(definitions)}")
    print(f"Roster entries: {len(roster_names)}")
    print("Roster / definition parity: " + ("OK" if not (unlisted or missing_files or duplicates) else "CHECK"))
    print("Model fields: " + ", ".join(f"{model}={count}" for model, count in sorted(model_counts.items())))

    if unlisted:
        print("Definitions missing from roster: " + ", ".join(unlisted))
    if missing_files:
        print("Roster names without definitions: " + ", ".join(missing_files))
    if duplicates:
        print("Duplicate agent names: " + ", ".join(duplicates))
    for error in errors:
        print("Metadata error: " + error)

    if args.search:
        query = args.search.casefold()
        matches = [
            (path, fields)
            for path, fields in definitions
            if query in fields.get("name", "").casefold()
            or query in fields.get("description", "").casefold()
        ]
        print(f"\nLiteral search {args.search!r}: {len(matches)} match(es)")
        for path, fields in matches:
            print(f"  {fields.get('name', path.stem)} ({fields.get('model', '(model unset)')})")
            print(f"    {fields.get('description', '')}")
    else:
        print("Use --search TEXT to find candidate descriptions; review the full agent file before assigning work.")

    return 1 if errors or unlisted or missing_files or duplicates else 0


if __name__ == "__main__":
    raise SystemExit(main())
