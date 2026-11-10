#!/usr/bin/env python3
"""Run CCGS launch-evidence helpers on known and missing temporary fixtures."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


DEFAULT_CCGS_ROOT = Path(__file__).resolve().parents[2] / "engine" / "Claude-Code-Game-Studios"
HELPERS = ("code-markers.sh", "bug-stats.sh")


def rows(output: str):
    return [line.split("\t") for line in output.splitlines() if line]


def find_row(output_rows, key: str):
    for row in output_rows:
        if row[0] == key:
            return row
    raise RuntimeError(f"CCGS helper output is missing the {key!r} row")


def invoke(script: Path, root: Path, *args: str):
    result = subprocess.run(
        ["bash", str(script), "--root", str(root), *args],
        cwd=str(root),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"{script.name} exited {result.returncode}: {result.stderr.strip()}\n{result.stdout}"
        )
    return rows(result.stdout)


def copy_helpers(ccgs_root: Path, project: Path):
    scripts = project / ".claude" / "scripts"
    scripts.mkdir(parents=True)
    copied = {}
    for name in HELPERS:
        source = ccgs_root / ".claude" / "scripts" / name
        if not source.is_file():
            raise RuntimeError(f"missing CCGS helper: {source}")
        target = scripts / name
        shutil.copy2(source, target)
        copied[name] = target
    return copied


def create_known_fixture(project: Path):
    source = project / "src" / "player.gd"
    source.parent.mkdir(parents=True)
    source.write_text(
        "# TODO: handle reconnect before launch\n"
        "func _ready():\n"
        "    print(\"debug build: localhost\")\n",
        encoding="utf-8",
    )
    bugs = project / "production" / "qa" / "bugs"
    bugs.mkdir(parents=True)
    (bugs / "BUG-1.md").write_text(
        "**ID**: BUG-1\n"
        "**Title**: Crash during save\n"
        "**Severity**: S1 (Critical)\n"
        "**Priority**: P1\n"
        "**Status**: Open\n"
        "**Reported**: 2026-11-10\n"
        "**System**: Save\n",
        encoding="utf-8",
    )
    (bugs / "BUG-2.md").write_text(
        "**ID**: BUG-2\n"
        "**Title**: Fixed menu focus\n"
        "**Severity**: S2 (High)\n"
        "**Priority**: P2\n"
        "**Status**: Verified Fixed\n"
        "**Reported**: 2026-11-09\n"
        "**System**: UI\n",
        encoding="utf-8",
    )


def summarize_known(project: Path, copied):
    code = invoke(copied["code-markers.sh"], project, "src")
    bugs = invoke(copied["bug-stats.sh"], project)
    expected = {
        "scanned_files": "1",
        "todo": "1",
        "debug": "1",
    }
    for key, value in expected.items():
        if find_row(code, key)[1] != value:
            raise RuntimeError(f"expected code-markers {key}={value}; got {find_row(code, key)}")
    if find_row(bugs, "bugs")[1] != "2":
        raise RuntimeError(f"expected two bug records; got {find_row(bugs, 'bugs')}")
    if find_row(bugs, "open_s1")[1] != "1" or find_row(bugs, "open")[1] != "1":
        raise RuntimeError("fixture should contain exactly one open S1 bug")

    print("## Fixture with recorded evidence")
    for key in ("scanned_files", "todo", "fixme", "hack", "debug", "placeholder"):
        print("  " + "\t".join(find_row(code, key)))
    for key in ("bugs", "open", "closed", "open_s1", "open_s2"):
        print("  " + "\t".join(find_row(bugs, key)))
    print("  launch interpretation: NOT READY (the scan found debug output and an open S1 bug).")


def summarize_missing(project: Path, copied):
    (project / "src").mkdir(parents=True)
    code = invoke(copied["code-markers.sh"], project, "src")
    bugs = invoke(copied["bug-stats.sh"], project)
    if find_row(code, "scanned_files")[1] != "0":
        raise RuntimeError("empty fixture unexpectedly contains source files")
    if find_row(bugs, "bugs")[1] != "0":
        raise RuntimeError("empty fixture unexpectedly contains bug records")

    print("\n## Fixture with missing evidence")
    for key in ("scanned_files", "todo", "debug"):
        print("  " + "\t".join(find_row(code, key)))
    print("  " + "\t".join(find_row(bugs, "bugs")))
    print("  launch interpretation: NOT ASSESSED (no source files and no bug records).")
    print("  The helper's raw zero counts are observations, not proof that checks passed.")


def exercise(ccgs_root: Path) -> int:
    ccgs_root = ccgs_root.expanduser().resolve()
    with tempfile.TemporaryDirectory(prefix="ccgs-launch-evidence-") as temporary:
        root = Path(temporary)
        known = root / "known-project"
        missing = root / "missing-project"
        known.mkdir()
        missing.mkdir()
        known_helpers = copy_helpers(ccgs_root, known)
        missing_helpers = copy_helpers(ccgs_root, missing)
        create_known_fixture(known)

        print("CCGS launch evidence exercise (synthetic projects in a temporary directory)")
        print("Using the real CCGS code-markers.sh and bug-stats.sh; only temporary fixtures are written.\n")
        summarize_known(known, known_helpers)
        summarize_missing(missing, missing_helpers)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ccgs-root",
        type=Path,
        default=DEFAULT_CCGS_ROOT,
        help="CCGS source snapshot (defaults to engine/Claude-Code-Game-Studios)",
    )
    args = parser.parse_args()
    try:
        return exercise(args.ccgs_root)
    except (OSError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
