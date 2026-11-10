#!/usr/bin/env python3
"""Preview or add a small Skill + Rule + spec customization to a CCGS copy."""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path


COURSE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = COURSE_ROOT.parent
DEFAULT_PROJECT = COURSE_ROOT / "practice" / "workspace"
SOURCE_PROJECT = REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
SKILL_NAME = "dialogue-row-audit"


SKILL = """---
name: dialogue-row-audit
description: "Audit one dialogue CSV for its exact columns, empty values and duplicate key/locale pairs. Read-only; use when checking a project's dialogue data."
argument-hint: "<csv-path>"
user-invocable: true
allowed-tools: Read, Bash(python3 .claude/skills/dialogue-row-audit/scripts/inspect_dialogue_csv.py *)
model: sonnet
---

# Dialogue Row Audit

This project-specific Skill checks structural facts. It does not decide
whether a translation is natural or whether every required locale is present.

## Phase 1: Parse Arguments

- Require exactly one CSV path under assets/dialogue/.
- If the path is absent, outside that folder, unreadable or not valid UTF-8 CSV,
  report NOT ASSESSED with the reason. Do not search unrelated directories or
  infer that missing data is clean.
- Use Read on the supplied CSV path before running the helper. This confirms
  the file and lets Claude Code load its matching path Rule; use a limited range
  for a large file.

## Phase 2: Collect structural observations

Run:

~~~sh
python3 .claude/skills/dialogue-row-audit/scripts/inspect_dialogue_csv.py --csv "<csv-path>"
~~~

The helper prints JSON facts and does not edit files. It checks required and
unexpected columns, duplicate column names, duplicate key/locale pairs and
blank required values. If it exits non-zero or reports parse=failed, stop and mark the audit
NOT ASSESSED. Quote the helper's findings; do not invent a verdict from missing
output.

## Phase 3: Assess and report

- FAIL if a required column is missing, a column is unexpected, a column name
  is duplicated, a required value is blank, or the same key and locale pair
  occurs more than once.
- NOT ASSESSED if the file cannot be read or has no data rows.
- PASS only when the CSV parses, has all required columns and rows, and the
  helper reports no extra columns, duplicate headers, duplicate pairs or blank
  required values.
- Locale completeness is always NOT ASSESSED unless the user provides an
  explicit expected-locale list. A key repeated across different locales is
  valid.
- Report the path, row count, findings and verdict. Separate the structural
  verdict from the locale-completeness note.
- Do not rename keys, rewrite translations or write a report file.

## Follow-Up Actions

For missing translations, suggest /localize after the expected locale list is
confirmed. For structural failures, show the affected row and field so the user
can decide how to correct the source data.
"""

HELPER = r'''#!/usr/bin/env python3
"""Report structural facts for one CSV beneath assets/dialogue/; write nothing."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path


REQUIRED = ("key", "locale", "text")


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True, type=Path, help="one CSV below assets/dialogue/")
    args = parser.parse_args()

    project = Path.cwd().resolve()
    allowed_root = (project / "assets" / "dialogue").resolve()
    candidate = args.csv.expanduser()
    if not candidate.is_absolute():
        candidate = project / candidate
    candidate = candidate.resolve()
    try:
        relative = candidate.relative_to(allowed_root)
    except ValueError:
        emit({"parse": "failed", "error": "path must stay under assets/dialogue/"})
        return 2
    if candidate.suffix.lower() != ".csv" or not candidate.is_file():
        emit({"parse": "failed", "error": "CSV file does not exist or has the wrong extension"})
        return 2

    try:
        with candidate.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream, strict=True)
            headers = reader.fieldnames or []
            duplicate_headers = sorted({header for header in headers if headers.count(header) > 1})
            missing_columns = [column for column in REQUIRED if column not in headers]
            extra_columns = [column for column in headers if column not in REQUIRED]
            duplicate_pairs = {}
            empty_fields = []
            locales_seen = set()
            row_count = 0

            for row in reader:
                row_count += 1
                row_number = reader.line_num
                for field in REQUIRED:
                    if field in headers and not (row.get(field) or "").strip():
                        empty_fields.append({"row": row_number, "field": field})
                key = (row.get("key") or "").strip()
                locale = (row.get("locale") or "").strip()
                if locale:
                    locales_seen.add(locale)
                if key and locale:
                    duplicate_pairs.setdefault((key, locale), []).append(row_number)

    except (OSError, UnicodeError, csv.Error) as error:
        emit({"parse": "failed", "error": str(error)})
        return 2

    duplicates = [
        {"key": key, "locale": locale, "rows": rows}
        for (key, locale), rows in sorted(duplicate_pairs.items())
        if len(rows) > 1
    ]
    emit({
        "parse": "ok",
        "path": relative.as_posix(),
        "headers": headers,
        "duplicate_headers": duplicate_headers,
        "missing_columns": missing_columns,
        "extra_columns": extra_columns,
        "row_count": row_count,
        "empty_fields": empty_fields,
        "duplicate_key_locale": duplicates,
        "locales_seen": sorted(locales_seen),
        "expected_locales": "not provided",
    })
    return 0


if __name__ == "__main__":
    sys.exit(main())
'''

RULE = """---
paths:
  - "assets/dialogue/**/*.csv"
---

# Dialogue CSV Contract

- Keep the exact header: key, locale, text.
- Keep each key stable across locales; one key may have one row per locale.
- Do not reuse a key/locale pair or leave a required cell blank.
- This rule supplies editing context. It is not a parser or a pass/fail check;
  run the project's dialogue audit Skill for structural observations.
- Do not rename or rewrite source dialogue during an audit.
"""

SPEC = """# Skill Test Spec: /dialogue-row-audit

## Skill Summary

Read one project dialogue CSV, collect structural facts with the bundled
read-only helper, and report duplicate key/locale pairs and blank required
values without editing the source file.

---

## Static Assertions (Structural)

- [ ] Frontmatter has name, description, argument-hint, user-invocable and allowed-tools
- [ ] The skill has at least two phase headings
- [ ] The skill defines PASS, FAIL and NOT ASSESSED outcomes
- [ ] The skill does not write a report or change the CSV
- [ ] A Follow-Up Actions section ends the skill

## Director Gate Checks

- N/A: this is a read-only utility skill; it does not change project phase or
  trigger director gates.

## Fixture Defaults

Each case supplies the dialogue CSV content and path it needs. No game engine
or external service is required.

## Test Cases

### Case 1: Valid rows for two locales

Fixture: assets/dialogue/menu.csv contains the exact required header, two
non-empty rows, and one stable key used once per locale.

Expected: the skill reports the row count and PASS for structural checks. It
notes locale completeness as NOT ASSESSED because no expected locale list was
provided.

Assertions:
- [ ] The same key in different locales is accepted
- [ ] The structural result is PASS
- [ ] Locale completeness is not claimed as PASS

### Case 2: Duplicate key and locale

Fixture: two rows share both key and locale but have different text.

Expected: the helper observation identifies the repeated pair and row numbers;
the skill reports FAIL and does not silently choose one row.

Assertions:
- [ ] The duplicate key/locale pair is named
- [ ] The result is FAIL
- [ ] The source CSV is not changed

### Case 3: Blank required value

Fixture: one row has an empty text cell.

Expected: the skill names the row and field and reports FAIL.

Assertions:
- [ ] The empty text cell is identified
- [ ] The skill does not fill in dialogue

### Case 4: No readable file

Fixture: the requested path does not exist or is outside assets/dialogue/.

Expected: the skill reports NOT ASSESSED with the path problem and does not
scan unrelated locations.

Assertions:
- [ ] The result is NOT ASSESSED
- [ ] The reason is named
- [ ] No other directory is searched as a fallback

### Case 5: No rows

Fixture: a readable CSV has the required header and no data rows.

Expected: the skill reports NOT ASSESSED because there is no dialogue data to
review.

Assertions:
- [ ] Zero rows are not reported as a clean PASS
- [ ] The empty scope is named

### Case 6: Invalid columns

Fixture: the CSV is parseable but omits the locale column, repeats a column
name or includes an unexpected column.

Expected: the skill reports FAIL and names the missing, duplicated or extra
column.

Assertions:
- [ ] The column problem is named
- [ ] The helper observation is distinguished from the skill verdict

## Protocol Compliance

- [ ] Reads the source and reports findings without writing files
- [ ] Does not infer expected locales when none were supplied
- [ ] Ends with a relevant follow-up

## Coverage Notes

The spec evaluates the written skill instructions. It does not execute the
helper or determine translation quality; those require separate observations.
"""

SAMPLE = """key,locale,text
menu.play,en,Play
menu.play,zh-CN,开始游戏
"""


def planned_files(project):
    return {
        project / ".claude" / "skills" / SKILL_NAME / "SKILL.md": SKILL,
        project / ".claude" / "skills" / SKILL_NAME / "scripts" / "inspect_dialogue_csv.py": HELPER,
        project / ".claude" / "rules" / "dialogue-csv.md": RULE,
        project / "studio-tests" / "skills" / "utility" / (SKILL_NAME + ".md"): SPEC,
        project / "assets" / "dialogue" / "menu.csv": SAMPLE,
    }


def catalog_with_entry(catalog_text):
    if re.search(r"^  - name: " + re.escape(SKILL_NAME) + r"$", catalog_text, re.MULTILINE):
        raise ValueError(f"{SKILL_NAME} is already registered in catalog.yaml")
    lines = catalog_text.splitlines()
    agent_rows = [index for index, line in enumerate(lines) if line == "agents:"]
    if len(agent_rows) != 1 or "skills:" not in lines:
        raise ValueError("catalog.yaml does not have the expected skills:/agents: sections")
    index = agent_rows[0]
    entry = [
        "  - name: dialogue-row-audit",
        "    spec: studio-tests/skills/utility/dialogue-row-audit.md",
        '    last_static: ""',
        '    last_static_result: ""',
        '    last_spec: ""',
        '    last_spec_result: ""',
        '    last_category: ""',
        '    last_category_result: ""',
        "    priority: low",
        "    category: utility",
        "",
    ]
    return "\n".join(lines[:index] + entry + lines[index:]) + "\n"


def prepare(project_arg, apply):
    project = project_arg.expanduser().resolve()
    source = SOURCE_PROJECT.resolve()
    if project == source:
        print("Refusing to modify the CCGS source snapshot; use a disposable copy.", file=sys.stderr)
        return 2
    if not project.is_dir():
        print(f"CCGS copy does not exist: {project}\nCreate it with practice/create_sandbox.py first.", file=sys.stderr)
        return 2

    required = (
        project / ".claude" / "settings.json",
        project / ".claude" / "rules",
        project / ".claude" / "skills" / "skill-test" / "SKILL.md",
        project / "studio-tests" / "catalog.yaml",
        project / "studio-tests" / "quality-rubric.md",
    )
    if not all(path.exists() for path in required):
        print(f"Not a CCGS project copy: {project}", file=sys.stderr)
        return 2

    files = planned_files(project)
    catalog_path = project / "studio-tests" / "catalog.yaml"
    catalog_temp = catalog_path.with_name(catalog_path.name + ".tmp")
    for path in list(files) + [catalog_path, catalog_temp]:
        try:
            path.resolve().relative_to(project)
        except ValueError:
            print(f"Refusing a path that resolves outside the copy: {path}", file=sys.stderr)
            return 2
        if path.is_symlink():
            print(f"Refusing to write through a symlink: {path}", file=sys.stderr)
            return 2
    try:
        updated_catalog = catalog_with_entry(catalog_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError) as error:
        print(f"Cannot prepare catalog update: {error}", file=sys.stderr)
        return 2
    if catalog_temp.exists() or catalog_temp.is_symlink():
        print(f"Refusing to overwrite temporary file: {catalog_temp}", file=sys.stderr)
        return 2

    occupied = [path for path in files if path.exists() or path.is_symlink()]
    if occupied:
        print("Refusing to overwrite existing customization files:", file=sys.stderr)
        for path in occupied:
            print(f"- {path}", file=sys.stderr)
        return 2

    print(f"CCGS copy: {project}")
    for path in files:
        print(f"create: {path.relative_to(project).as_posix()}")
    print("update: studio-tests/catalog.yaml (register utility skill and spec)")
    if not apply:
        print("Dry run only. Add --apply to create these files in this copy.")
        return 0

    created = []
    try:
        for path, content in files.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            created.append(path)
        catalog_temp.write_text(updated_catalog, encoding="utf-8")
        os.replace(catalog_temp, catalog_path)
    except OSError as error:
        for path in created:
            try:
                path.unlink()
            except OSError:
                pass
        try:
            catalog_temp.unlink()
        except OSError:
            pass
        print(f"Customization was not completed: {error}", file=sys.stderr)
        return 1

    print("Created the Skill, scoped Rule, behavioral spec and sample CSV.")
    print("The helper emits observations only; run /skill-test in this isolated copy.")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=DEFAULT_PROJECT, help="disposable CCGS copy")
    parser.add_argument("--apply", action="store_true", help="write the previewed files; default is dry-run")
    args = parser.parse_args()
    return prepare(args.project, args.apply)


if __name__ == "__main__":
    sys.exit(main())
