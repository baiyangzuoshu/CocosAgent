#!/usr/bin/env python3
"""Generate temporary JUnit history and run the real CCGS flaky-stats helper."""

from __future__ import annotations

import argparse
import csv
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path


DEFAULT_CCGS_ROOT = Path(__file__).resolve().parents[2] / "engine" / "Claude-Code-Game-Studios"
DEFAULT_FIXTURE = Path(__file__).resolve().parent / "fixtures" / "s29_test_flakiness" / "run_matrix.csv"
VALID_OUTCOMES = {"PASS", "FAIL", "SKIP"}


def load_matrix(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        headers = reader.fieldnames or []
        run_names = [name for name in headers if name.startswith("run_")]
        rows = list(reader)
    if not run_names or not rows:
        raise RuntimeError("run_matrix.csv must have test_id and at least one run_N column")
    for row in rows:
        if not row.get("test_id"):
            raise RuntimeError("every fixture row needs a test_id")
        for name in run_names:
            outcome = (row.get(name) or "").strip().upper()
            if outcome and outcome not in VALID_OUTCOMES:
                raise RuntimeError(f"unexpected outcome {outcome!r} for {row['test_id']} in {name}")
    return run_names, rows


def write_junit_run(path: Path, run_name: str, rows: list[dict[str, str]]) -> None:
    suite = ET.Element("testsuite", name=run_name)
    for row in rows:
        outcome = (row.get(run_name) or "").strip().upper()
        if not outcome:
            continue
        case = ET.SubElement(suite, "testcase", classname="ccgs.exercise", name=row["test_id"])
        if outcome == "FAIL":
            failure = ET.SubElement(case, "failure", message="synthetic failure")
            failure.text = "Synthetic course fixture; no game test was executed."
        elif outcome == "SKIP":
            ET.SubElement(case, "skipped", message="synthetic skip")
    ET.ElementTree(suite).write(path, encoding="utf-8", xml_declaration=True)


def run_stats(scanner: Path, root: Path, files: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(scanner), "--root", str(root), "--format", "junit", "--runs", "--all", *files],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def parse_rows(output: str) -> list[list[str]]:
    return [line.split("\t") for line in output.splitlines() if line]


def find_row(rows: list[list[str]], tag: str, field: str) -> list[str]:
    for row in rows:
        if row[0] == tag and len(row) > 1 and row[1] == field:
            return row
    raise RuntimeError(f"missing flaky-stats row: {tag} {field}")


def require_test(rows: list[list[str]], name: str, *, runs: str, fail_pct: str, tier: str) -> None:
    for row in rows:
        if row[0] == "TEST" and row[1] == name:
            if row[2] != runs or row[6] != fail_pct or row[9] != tier:
                raise RuntimeError(f"unexpected stats row for {name}: {' | '.join(row)}")
            return
    raise RuntimeError(f"missing test row: {name}")


def exercise(ccgs_root: Path, fixture: Path) -> None:
    ccgs_root = ccgs_root.expanduser().resolve()
    fixture = fixture.expanduser().resolve()
    scanner = ccgs_root / ".claude" / "scripts" / "flaky-stats.sh"
    if not scanner.is_file():
        raise RuntimeError(f"missing CCGS flaky stats helper: {scanner}")
    run_names, matrix = load_matrix(fixture)

    with tempfile.TemporaryDirectory(prefix="ccgs-test-flakiness-") as temporary:
        root = Path(temporary) / "project"
        results = root / "test-results"
        results.mkdir(parents=True)
        files = []
        for index, run_name in enumerate(run_names, start=1):
            filename = f"run_{index:02d}.xml"
            write_junit_run(results / filename, run_name, matrix)
            files.append(f"test-results/{filename}")

        result = run_stats(scanner, root, files)
        if result.returncode != 0:
            raise RuntimeError(f"flaky-stats exited {result.returncode}: {result.stderr.strip()}\n{result.stdout}")
        rows = parse_rows(result.stdout)
        if find_row(rows, "runs", "5")[2:] != ["5"]:
            raise RuntimeError("expected five files with test results")
        if not any(row[0] == "tests" and row[1] == "6" for row in rows):
            raise RuntimeError("expected six distinct tests")
        require_test(rows, "ccgs.exercise.test_timing_sensitive", runs="5", fail_pct="40.0", tier="high")
        require_test(rows, "ccgs.exercise.test_physics_tolerance", runs="5", fail_pct="20.0", tier="moderate")
        require_test(rows, "ccgs.exercise.test_scene_race", runs="2", fail_pct="50.0", tier="suspected")
        require_test(rows, "ccgs.exercise.test_always_red", runs="5", fail_pct="100.0", tier="always-fail")
        require_test(rows, "ccgs.exercise.test_skip_only", runs="0", fail_pct="-", tier="no-result")
        require_test(rows, "ccgs.exercise.test_stable_menu", runs="5", fail_pct="0.0", tier="none")

        print("CCGS flaky-stats.sh output (synthetic JUnit run history)")
        for row in rows:
            print("  " + " | ".join(row))
        print("\nThe helper counted PASS and FAIL as runs; SKIP did not enter the denominator.")

        empty_root = Path(temporary) / "empty_result_project"
        empty_results = empty_root / "test-results"
        empty_results.mkdir(parents=True)
        (empty_results / "empty.xml").write_text("<testsuite name=\"empty\"></testsuite>\n", encoding="utf-8")
        empty = run_stats(scanner, empty_root, ["test-results/empty.xml"])
        if empty.returncode != 4:
            raise RuntimeError(f"expected exit 4 for a readable XML file with no results, got {empty.returncode}")
        print("\nEmpty result file:")
        print(f"  exit_code: {empty.returncode} (file read, no test results parsed)")
        for row in parse_rows(empty.stdout):
            print("  " + " | ".join(row))

    print("No game tests were executed; all JUnit history was generated in a temporary directory.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ccgs-root", type=Path, default=DEFAULT_CCGS_ROOT)
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    args = parser.parse_args()
    try:
        exercise(args.ccgs_root, args.fixture)
    except (OSError, RuntimeError, ValueError, KeyError, csv.Error) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
