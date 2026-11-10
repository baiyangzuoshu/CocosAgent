#!/usr/bin/env python3
"""Run CCGS bug-stats.sh against synthetic bug reports and show triage evidence."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


DEFAULT_CCGS_ROOT = Path(__file__).resolve().parents[2] / "engine" / "Claude-Code-Game-Studios"
DEFAULT_FIXTURES = Path(__file__).resolve().parent / "fixtures" / "s24_bugs"


def rows(output: str):
    return [line.split("\t") for line in output.splitlines() if line]


def one_row(output_rows, key: str):
    for row in output_rows:
        if row[0] == key:
            return row
    raise RuntimeError(f"bug-stats.sh output is missing {key!r}")


def markdown_field(path: Path, name: str):
    prefix = f"**{name}**:"
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(prefix):
            return line[len(prefix) :].strip()
    return None


def run_helper(script: Path, root: Path):
    result = subprocess.run(
        ["bash", str(script), "--root", str(root), "--today", "2026-11-11"],
        cwd=str(root),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"bug-stats.sh exited {result.returncode}: {result.stderr.strip()}")
    return result.stdout


def exercise(ccgs_root: Path, fixtures: Path):
    ccgs_root = ccgs_root.expanduser().resolve()
    fixtures = fixtures.expanduser().resolve()
    helper_source = ccgs_root / ".claude" / "scripts" / "bug-stats.sh"
    if not helper_source.is_file():
        raise RuntimeError(f"missing CCGS helper: {helper_source}")
    bug_files = sorted(fixtures.glob("BUG-*.md"))
    if not bug_files:
        raise RuntimeError(f"no BUG-*.md fixtures found in {fixtures}")

    with tempfile.TemporaryDirectory(prefix="ccgs-bug-triage-") as temporary:
        root = Path(temporary)
        helper = root / ".claude" / "scripts" / "bug-stats.sh"
        helper.parent.mkdir(parents=True)
        shutil.copy2(helper_source, helper)
        bugs = root / "production" / "qa" / "bugs"
        bugs.mkdir(parents=True)
        for source in bug_files:
            shutil.copy2(source, bugs / source.name)

        output = run_helper(helper, root)

    parsed = rows(output)
    counts = {key: one_row(parsed, key) for key in ("bugs", "open", "closed", "open_s1", "open_s2")}
    bug_rows = {row[1]: row for row in parsed if row[0] == "BUG"}
    network = next((row for row in parsed if row[0] == "system" and row[1] == "Network"), None)
    if counts["bugs"][1] != "6" or counts["open"][1] != "5" or counts["closed"][1] != "1":
        raise RuntimeError("fixture should produce 6 bugs: 5 open and 1 closed")
    if not network or network[2:4] != ["3", "2"]:
        raise RuntimeError("Network should have 3 open bugs, 2 of them S1/S2")
    if bug_rows.get("BUG-0001", [])[3:5] != ["S1", "P2"]:
        raise RuntimeError("BUG-0001 should demonstrate S1 severity with P2 priority")
    if bug_rows.get("BUG-0003", [])[3:5] != ["S3", "P1"]:
        raise RuntimeError("BUG-0003 should demonstrate S3 severity with P1 priority")

    print("CCGS bug triage exercise (synthetic reports in a temporary directory)")
    print("Using the real CCGS bug-stats.sh; the helper emits observations, not triage decisions.\n")
    print("Summary:")
    for key in ("bugs", "open", "closed", "open_s1", "open_s2"):
        print("  " + "\t".join(counts[key]))
    print("\nOpen bugs by system:")
    for row in parsed:
        if row[0] == "system":
            print("  " + "\t".join(row))
    print("\nSeverity / priority examples:")
    for bug_id in ("BUG-0001", "BUG-0003", "BUG-0004"):
        print("  " + "\t".join(bug_rows[bug_id]))
    missing_sprint = markdown_field(fixtures / "BUG-0004.md", "Sprint")
    print(f"  BUG-0004 Sprint field: {missing_sprint or '(absent)'}")
    print("\nTriage questions to apply from bug-triage/SKILL.md:")
    print("  Network has 3 open reports in Sprint 4; check its same-system threshold and story-101's S1/S2 count.")
    print("  Save has an open S1 with no Sprint field; confirm an owner and sprint capacity before assignment.")
    print("  The helper does not decide P1/P2, reopen stories, mark P4, or approve a release.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ccgs-root", type=Path, default=DEFAULT_CCGS_ROOT)
    parser.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES)
    args = parser.parse_args()
    try:
        exercise(args.ccgs_root, args.fixtures)
    except (OSError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
